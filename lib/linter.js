const walk = require('walk')
const fs = require('fs')
const path = require('path')
const htmlparser = require('htmlparser2')
const cheerio = require('cheerio')
const PugLint = require('@hb/pug-lint')
const pugLintConfigFile = require('@hb/pug-lint/lib/config-file')
const Reporter = require('./reporter.js')
const rules = require('../.pug-lintrc.js')

class Linter {
  constructor (options) {
    this.lintErrors = []
    this.pugLinter = new PugLint()

    const pugLinterConfig = pugLintConfigFile.load(options.config)
    console.log(pugLinterConfig)
    this.pugLinter.configure(pugLinterConfig || rules)
  }

  checkPaths (pathsToCheck) {
    pathsToCheck.forEach((pathToCheck) => {
      this.checkPath(pathToCheck)
    })
  }

  checkPath (arg) {
    const walker = walk.walk(arg, { followLinks: false })
    walker.on('file', this.walkerFileHandler.bind(this))
    walker.on('end', this.walkerEndHandler.bind(this))
  }

  walkerFileHandler (root, fileStat, next) {
    const filename = `${root}/${fileStat.name}`

    if (filename.substr(-3) !== 'vue') {
      return next()
    }

    fs.readFile(path.resolve(root, fileStat.name), (error, fileData) => {
      if (error) {
        return console.log(error)
      }

      const fileTemplates = this.extractFileTemplates(fileData)

      fileTemplates.forEach((template) => {
        const fileErrors = this.pugLinter.checkString(template, filename)
        this.lintErrors = this.lintErrors.concat(fileErrors)
      })

      next()
    })
  }

  walkerEndHandler () {
    const reporter = new Reporter()
    reporter.report(this.lintErrors)
  }

  extractFileTemplates (fileData) {
    let templates = []

    const handler = new htmlparser.DefaultHandler((error, dom) => {
      if (error) {
        return console.log(error)
      }

      const $ = cheerio.load(dom)
      templates = templates.concat($('template[lang="pug"]').text())
    })

    var parser = new htmlparser.Parser(handler)
    parser.parseComplete(fileData)
    return templates
  }
}

module.exports = Linter
