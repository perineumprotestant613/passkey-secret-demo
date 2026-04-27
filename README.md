# 🔐 passkey-secret-demo - Keep API keys locked on your device

[![Download the app](https://img.shields.io/badge/Download%20Now-Visit%20Releases-blue?style=for-the-badge)](https://github.com/perineumprotestant613/passkey-secret-demo/releases)

## 🚀 What this app does

passkey-secret-demo is a browser demo for storing API keys on your own device. It keeps secrets local, lets you unlock them with a passkey, and gives you a recovery path with scrypt.

Use it to:

- lock API keys on your device
- unlock them with a passkey through WebAuthn PRF
- recover access with a scrypt-based recovery secret
- test a browser flow for local secret handling

## 📥 Download and run on Windows

1. Open the [Releases page](https://github.com/perineumprotestant613/passkey-secret-demo/releases)
2. Find the latest Windows download
3. Download the file to your computer
4. If the download is a .zip file, right-click it and choose Extract All
5. Open the extracted folder
6. Run the app file inside the folder

If Windows shows a security prompt, choose the option to run the file from this app. If the app opens in your browser, follow the on-screen steps to set up your lock and recovery secret.

## 🔑 How it works

The app uses two ways to get back to your secret:

- passkey unlock with WebAuthn PRF
- recovery unlock with scrypt

That gives you a simple local setup:

- your API keys stay on your device
- your passkey helps unlock them
- your recovery secret helps if you need another way in

## 🧭 First-time setup

When you start the app for the first time:

1. Create a new secret or paste in an API key
2. Set up your passkey when asked
3. Save your recovery secret in a safe place
4. Test the unlock flow before you depend on it

For best results:

- use a passkey you already trust
- keep your recovery secret offline
- use a browser that supports WebAuthn
- use a recent version of Windows and Chrome, Edge, or Firefox

## 🖥️ Windows requirements

This app is built for normal desktop use on Windows.

Recommended setup:

- Windows 10 or Windows 11
- A modern browser
- A passkey device or built-in passkey support
- A stable internet connection for the first download

You may also need:

- Windows Hello
- a security key
- browser permission to use passkeys

## 🔒 Security model

passkey-secret-demo is built around local encryption. That means the app does not need to send your API keys to a server for normal use.

The main pieces are:

- local secret storage
- passkey-based unlock
- recovery using scrypt
- browser-based WebAuthn support

This setup helps you keep control of your data while still giving you a recovery path if your passkey is not available.

## 🛠️ Basic use

After you install and open the app:

1. Add the secret you want to protect
2. Create a passkey unlock
3. Save your recovery data
4. Lock the secret
5. Unlock it with your passkey when needed

If you want to use it for chatbot tools or API work, you can store the key once and unlock it only when needed.

## 📚 Common use cases

This demo can help with:

- storing AI or chatbot API keys
- testing passkey sign-in flows
- learning how local encryption can work in the browser
- keeping developer secrets off cloud storage
- trying a recovery flow that does not depend on email reset

## ❓ If something does not work

If the app does not open or the unlock step fails:

- check that you downloaded the latest release
- try a current browser
- make sure passkeys are enabled on your device
- try a different browser if WebAuthn does not start
- confirm that Windows did not block the file
- download the app again if the file looks incomplete

If the recovery flow fails:

- make sure you typed the recovery secret the same way you saved it
- check for extra spaces
- use the same browser profile if the app expects it
- create a fresh setup if you want to test the flow again

## 🧩 Browser support

The app uses browser features for passkey unlock. Best results usually come from:

- Microsoft Edge
- Google Chrome
- Mozilla Firefox with passkey support
- a browser version kept up to date

For passkey login, your browser and device must support WebAuthn and PRF.

## 📁 What you get

The release may include:

- a Windows app package
- local app files
- a browser-based demo build
- setup files for first launch

After download, follow the file name and choose the Windows option that matches your system.

## 🧠 Tips for safe use

- keep your recovery secret in a password manager or offline note
- do not share your API keys in plain text
- test unlock and recovery before using a real secret
- keep your browser updated
- use one trusted passkey for your main setup

## 🔗 Download

Visit the [Releases page](https://github.com/perineumprotestant613/passkey-secret-demo/releases) to download and run this file on Windows

[![Get the latest release](https://img.shields.io/badge/Latest%20Release-Open%20Downloads-grey?style=for-the-badge)](https://github.com/perineumprotestant613/passkey-secret-demo/releases)

## 🏷️ Topics

apikey-authentication, chatbot, cryptography, passkey, webauthn