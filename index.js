const core = require('@actions/core');
const simpleGit = require('simple-git');
const fs = require("fs")

const typeLabels = {
    fix: "Bug Fixes",
    tweak: "Changes",
    feat: "New Features",
    perf: "Performance Upgrades",
    docs: "Documentation",
    other: "Other Changes"
}

// Splits a commit message into type, category and message
function processCommit(commitMessage) {
    const commitDetails = commitMessage.split(':')

    // Split Meta Information
    const metadata = commitDetails[0]
    let type = ""
    let category = ""
    if (metadata.includes('(') && metadata.includes(')')) {
        type = metadata.split('(')[0]
        category = metadata.split('(')[1].replace(')', '')
    } else {
        type = metadata
    }

    // Split Message
    const message = commitDetails[1]
    return {type: type.trim(), category: category.trim(), message: message.trim()}
}

// Loops through each commit, splits it and returns a list sorted by type
function processCommits(rawCommits) {
    var commits = {
        // Example
        // tweak = [{type, category, message}]
    }

    // Load empty arrays
    for (const type in typeLabels) {
        commits[type] = []
    }

    rawCommits.forEach(commit => {
        const msg = commit.message
        // console.log(`Commit Message: ${msg}`)

        if (msg.includes(':')) {            
            const commit = processCommit(msg)

            // Categorise and push to arrays
            if (typeLabels[commit.type] && !msg.includes('[ignore]') && !msg.includes('Merge branch')) {
                commits[commit.type].push(commit)

            // Dont include merges in release notes
            } else if(!msg.includes('Merge branch')) {
                commits["other"].push(commit)
            }

        } else {
            // console.log(`Skipping: invalid commit message`)
        }
    });

    return commits
}

// Internal function used in generateMarkdown
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Converts processed commits to markdown
function generateMarkdown(allCommits) {
    var output = ""

    for (const type in allCommits) {
        const typeLabel = typeLabels[type]
        const commits = allCommits[type];

        // Check if there are any commits of this type
        if (commits && commits.length > 0) {
            output += `## ${typeLabel}\n`

            commits.forEach(commit => {
                if (commit.category && commit.category.length > 0) {
                    output += `${capitalizeFirstLetter(commit.category)}: ${capitalizeFirstLetter(commit.message)}\n`
                } else {                
                    output += `${capitalizeFirstLetter(commit.message)}\n`
                }
            });

            output += "\n"
        } else {
            // console.log(`No commits of type "${type}". Skipping`)
        }

    }

    return output
}

try {
    console.log("Preparing release...")
    const directoryString = core.getInput("directory")

    fs.access(directoryString, function(err) {
        console.log(err)
        if (!err) {
            console.log("Directory Found!")
            const git = simpleGit(directoryString)
            git.tags((err, tags) => {
                const tag = tags.latest
                console.log("Getting commits since " + (tag ? tag : "initial commit"))
                git.log(tag ? {from: tag, to: "HEAD"} : null).then(output => {
                    const commits = processCommits(output.all)
                    const formattedOutput = generateMarkdown(commits)
                    core.setOutput("changelog", formattedOutput)
                })
            })
        } else {
            console.log("Directory not found!")
            core.setFailed("File directory doesn't exist.")
        }
    })

} catch (error) {
    core.setFailed(error.message);
}