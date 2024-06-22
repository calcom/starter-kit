#!/usr/bin/env node

const https = require("https");
const fs = require("fs");
const path = require("path");
const { exec, execSync, spawnSync } = require("child_process");
const process = require("process");
const DEFAULT_PLATFORM_DIRECTORY_NAME = "platform-starter-kit";

// Function to download the tar file
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    console.log("Downloading from URL", url, "to:", outputPath);
    const getRequest = (url) => {
      https
        .get(url, (response) => {
          // Handle redirect
          if (response.statusCode === 302 || response.statusCode === 301) {
            getRequest(response.headers.location); // Follow the redirect
          } else {
            response.pipe(file);
            file.on("finish", () => {
              file.close();
              resolve();
            });
          }
        })
        .on("error", (err) => {
          console.error("Error downloading the file:", err);
          reject(err);
        });
    };

    getRequest(url);
  });
}

// Function to extract the tar file
function extractTarFile({ filePath, extractTo, dirNameToExtract }) {
  return new Promise((resolve, reject) => {
    exec(
      `tar -xzf ${filePath} -C ${extractTo} ${dirNameToExtract}`,
      (error, stdout, stderr) => {
        if (error) {
          reject(`Extraction error: ${error.message}`);
          return;
        }
        if (stderr) {
          reject(`Extraction stderr: ${stderr}`);
          return;
        }
        resolve(stdout);
      }
    );
  });
}

// Main function to handle the CLI logic
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1 || args[0] !== "my-platform") {
    console.error("Usage: cli.js my-platform [platform-directory-name]");
    process.exit(1);
  }
  const userPlatformDirectoryName = args[1] || DEFAULT_PLATFORM_DIRECTORY_NAME;
  const url =
    "https://github.com/calcom/platform-starter-kit/archive/refs/heads/main.tar.gz";
  const tarPath = "./platform-starter-kit-main.tar.gz";
  // Extract to current directory
  const extractTo = "./";

  try {
    console.log("Downloading the platform starter kit...");
    await downloadFile(url, tarPath);
    console.log("Download completed. Extracting...");
    const tempDirName = `platform-starter-kit-main`;
    await extractTarFile({
      filePath: tarPath,
      extractTo,
      dirNameToExtract: tempDirName,
    });

    fs.renameSync(tempDirName, userPlatformDirectoryName);
    console.log("Extraction completed.");
    fs.unlinkSync(tarPath); // Clean up the tar file
    console.log("Deleted the downloaded archive.");
    process.chdir(userPlatformDirectoryName);
    console.log(`Changed directory to ${process.cwd()}`);

    // Git init
    console.log("Initializing Git repository...");
    execSync("git init");
    console.log("Git repository initialized.");

    // Yarn install
    spawnSync("yarn", ["install"], {
      stdio: "inherit",
      shell: true,
    });

    console.log("Dependencies installed.");

    // Git commit
    execSync("git add .");
    execSync('git commit -m "Initial commit from @calcom/starter-kit"');
    console.log("Initial commit made.");
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}

main();
