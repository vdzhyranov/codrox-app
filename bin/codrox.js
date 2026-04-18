#!/usr/bin/env node
const { spawn } = require('child_process')
const path = require('path')
const electron = require('electron')

const appPath = path.resolve(__dirname, '..')
const child = spawn(String(electron), [appPath], {
  stdio: 'inherit',
  windowsHide: false
})
child.on('close', (code) => process.exit(code ?? 0))
