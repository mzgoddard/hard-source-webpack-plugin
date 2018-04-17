{
  'main.js': '/******/ (function(modules) { // webpackBootstrap\n/******/ \t// install a JSONP' +
      ' callback for chunk loading\n/******/ \tfunction webpackJsonpCallback(data) {\n/' +
      '******/ \t\tvar chunkIds = data[0];\n/******/ \t\tvar moreModules = data[1];\n/*' +
      '*****/\n/******/ \t\t// add "moreModules" to the modules object,\n/******/ \t\t/' +
      '/ then flag all "chunkIds" as loaded and fire callback\n/******/ \t\tvar moduleI' +
      'd, chunkId, i = 0, resolves = [];\n/******/ \t\tfor(;i < chunkIds.length; i++) {' +
      '\n/******/ \t\t\tchunkId = chunkIds[i];\n/******/ \t\t\tif(installedChunks[chunk' +
      'Id]) {\n/******/ \t\t\t\tresolves.push(installedChunks[chunkId][0]);\n/******/ ' +
      '\t\t\t}\n/******/ \t\t\tinstalledChunks[chunkId] = 0;\n/******/ \t\t}\n/******/ ' +
      '\t\tfor(moduleId in moreModules) {\n/******/ \t\t\tif(Object.prototype.hasOwnPro' +
      'perty.call(moreModules, moduleId)) {\n/******/ \t\t\t\tmodules[moduleId] = moreM' +
      'odules[moduleId];\n/******/ \t\t\t}\n/******/ \t\t}\n/******/ \t\tif(parentJsonp' +
      'Function) parentJsonpFunction(data);\n/******/ \t\twhile(resolves.length) {\n/**' +
      '****/ \t\t\tresolves.shift()();\n/******/ \t\t}\n/******/\n/******/ \t};\n/*****' +
      '*/\n/******/\n/******/ \t// The module cache\n/******/ \tvar installedModules = ' +
      '{};\n/******/\n/******/ \t// object to store loaded and loading chunks\n/******/' +
      ' \tvar installedChunks = {\n/******/ \t\t"main": 0\n/******/ \t};\n/******/\n/**' +
      '****/\n/******/\n/******/ \t// The require function\n/******/ \tfunction __webpa' +
      'ck_require__(moduleId) {\n/******/\n/******/ \t\t// Check if module is in cache' +
      '\n/******/ \t\tif(installedModules[moduleId]) {\n/******/ \t\t\treturn installed' +
      'Modules[moduleId].exports;\n/******/ \t\t}\n/******/ \t\t// Create a new module ' +
      '(and put it into the cache)\n/******/ \t\tvar module = installedModules[moduleId' +
      '] = {\n/******/ \t\t\ti: moduleId,\n/******/ \t\t\tl: false,\n/******/ \t\t\texp' +
      'orts: {}\n/******/ \t\t};\n/******/\n/******/ \t\t// Execute the module function' +
      '\n/******/ \t\tmodules[moduleId].call(module.exports, module, module.exports, __' +
      'webpack_require__);\n/******/\n/******/ \t\t// Flag the module as loaded\n/*****' +
      '*/ \t\tmodule.l = true;\n/******/\n/******/ \t\t// Return the exports of the mod' +
      'ule\n/******/ \t\treturn module.exports;\n/******/ \t}\n/******/\n/******/ \t// ' +
      'This file contains only the entry chunk.\n/******/ \t// The chunk loading functi' +
      'on for additional chunks\n/******/ \t__webpack_require__.e = function requireEns' +
      'ure(chunkId) {\n/******/ \t\tvar promises = [];\n/******/\n/******/\n/******/ \t' +
      '\t// JSONP chunk loading for javascript\n/******/\n/******/ \t\tvar installedChu' +
      'nkData = installedChunks[chunkId];\n/******/ \t\tif(installedChunkData !== 0) { ' +
      '// 0 means "already installed".\n/******/\n/******/ \t\t\t// a Promise means "cu' +
      'rrently loading".\n/******/ \t\t\tif(installedChunkData) {\n/******/ \t\t\t\tpro' +
      'mises.push(installedChunkData[2]);\n/******/ \t\t\t} else {\n/******/ \t\t\t\t//' +
      ' setup Promise in chunk cache\n/******/ \t\t\t\tvar promise = new Promise(functi' +
      'on(resolve, reject) {\n/******/ \t\t\t\t\tinstalledChunkData = installedChunks[c' +
      'hunkId] = [resolve, reject];\n/******/ \t\t\t\t});\n/******/ \t\t\t\tpromises.pu' +
      'sh(installedChunkData[2] = promise);\n/******/\n/******/ \t\t\t\t// start chunk ' +
      'loading\n/******/ \t\t\t\tvar head = document.getElementsByTagName(\'head\')[0];' +
      '\n/******/ \t\t\t\tvar script = document.createElement(\'script\');\n/******/\n/' +
      '******/ \t\t\t\tscript.charset = \'utf-8\';\n/******/ \t\t\t\tscript.timeout = 1' +
      '20;\n/******/\n/******/ \t\t\t\tif (__webpack_require__.nc) {\n/******/ \t\t\t\t' +
      '\tscript.setAttribute("nonce", __webpack_require__.nc);\n/******/ \t\t\t\t}\n/**' +
      '****/ \t\t\t\tscript.src = __webpack_require__.p + "" + chunkId + ".main.js";\n/' +
      '******/ \t\t\t\tvar timeout = setTimeout(function(){\n/******/ \t\t\t\t\tonScrip' +
      'tComplete({ type: \'timeout\', target: script });\n/******/ \t\t\t\t}, 120000);' +
      '\n/******/ \t\t\t\tscript.onerror = script.onload = onScriptComplete;\n/******/ ' +
      '\t\t\t\tfunction onScriptComplete(event) {\n/******/ \t\t\t\t\t// avoid mem leak' +
      's in IE.\n/******/ \t\t\t\t\tscript.onerror = script.onload = null;\n/******/ \t' +
      '\t\t\t\tclearTimeout(timeout);\n/******/ \t\t\t\t\tvar chunk = installedChunks[c' +
      'hunkId];\n/******/ \t\t\t\t\tif(chunk !== 0) {\n/******/ \t\t\t\t\t\tif(chunk) {' +
      '\n/******/ \t\t\t\t\t\t\tvar errorType = event && (event.type === \'load\' ? \'m' +
      'issing\' : event.type);\n/******/ \t\t\t\t\t\t\tvar realSrc = event && event.tar' +
      'get && event.target.src;\n/******/ \t\t\t\t\t\t\tvar error = new Error(\'Loading' +
      ' chunk \' + chunkId + \' failed.\\n(\' + errorType + \': \' + realSrc + \')\');' +
      '\n/******/ \t\t\t\t\t\t\terror.type = errorType;\n/******/ \t\t\t\t\t\t\terror.r' +
      'equest = realSrc;\n/******/ \t\t\t\t\t\t\tchunk[1](error);\n/******/ \t\t\t\t\t' +
      '\t}\n/******/ \t\t\t\t\t\tinstalledChunks[chunkId] = undefined;\n/******/ \t\t\t' +
      '\t\t}\n/******/ \t\t\t\t};\n/******/ \t\t\t\thead.appendChild(script);\n/******/' +
      ' \t\t\t}\n/******/ \t\t}\n/******/ \t\treturn Promise.all(promises);\n/******/ ' +
      '\t};\n/******/\n/******/ \t// expose the modules object (__webpack_modules__)\n/' +
      '******/ \t__webpack_require__.m = modules;\n/******/\n/******/ \t// expose the m' +
      'odule cache\n/******/ \t__webpack_require__.c = installedModules;\n/******/\n/**' +
      '****/ \t// define getter function for harmony exports\n/******/ \t__webpack_requ' +
      'ire__.d = function(exports, name, getter) {\n/******/ \t\tif(!__webpack_require_' +
      '_.o(exports, name)) {\n/******/ \t\t\tObject.defineProperty(exports, name, {\n/*' +
      '*****/ \t\t\t\tconfigurable: false,\n/******/ \t\t\t\tenumerable: true,\n/******' +
      '/ \t\t\t\tget: getter\n/******/ \t\t\t});\n/******/ \t\t}\n/******/ \t};\n/*****' +
      '*/\n/******/ \t// define __esModule on exports\n/******/ \t__webpack_require__.r' +
      ' = function(exports) {\n/******/ \t\tObject.defineProperty(exports, \'__esModule' +
      '\', { value: true });\n/******/ \t};\n/******/\n/******/ \t// getDefaultExport f' +
      'unction for compatibility with non-harmony modules\n/******/ \t__webpack_require' +
      '__.n = function(module) {\n/******/ \t\tvar getter = module && module.__esModule' +
      ' ?\n/******/ \t\t\tfunction getDefault() { return module[\'default\']; } :\n/***' +
      '***/ \t\t\tfunction getModuleExports() { return module; };\n/******/ \t\t__webpa' +
      'ck_require__.d(getter, \'a\', getter);\n/******/ \t\treturn getter;\n/******/ \t' +
      '};\n/******/\n/******/ \t// Object.prototype.hasOwnProperty.call\n/******/ \t__w' +
      'ebpack_require__.o = function(object, property) { return Object.prototype.hasOwn' +
      'Property.call(object, property); };\n/******/\n/******/ \t// __webpack_public_pa' +
      'th__\n/******/ \t__webpack_require__.p = "";\n/******/\n/******/ \t// on error f' +
      'unction for async loading\n/******/ \t__webpack_require__.oe = function(err) { c' +
      'onsole.error(err); throw err; };\n/******/\n/******/ \tvar jsonpArray = window["' +
      'webpackJsonp"] = window["webpackJsonp"] || [];\n/******/ \tvar oldJsonpFunction ' +
      '= jsonpArray.push.bind(jsonpArray);\n/******/ \tjsonpArray.push = webpackJsonpCa' +
      'llback;\n/******/ \tjsonpArray = jsonpArray.slice();\n/******/ \tfor(var i = 0; ' +
      'i < jsonpArray.length; i++) webpackJsonpCallback(jsonpArray[i]);\n/******/ \tvar' +
      ' parentJsonpFunction = oldJsonpFunction;\n/******/\n/******/\n/******/ \t// Load' +
      ' entry module and return exports\n/******/ \treturn __webpack_require__(__webpac' +
      'k_require__.s = "./index.js");\n/******/ })\n/**********************************' +
      '**************************************/\n/******/ ({\n\n/***/ "./index.js":\n/*!' +
      '******************!*\\\n  !*** ./index.js ***!\n  \\******************/\n/*! no ' +
      'static exports found */\n/***/ (function(module, exports, __webpack_require__) {' +
      '\n\neval("__webpack_require__.e(/*! import() */ 0).then(__webpack_require__.bind' +
      '(null, /*! ./obj */ \\"./obj.js\\"))\\n.then(({fib}) => {\\n  console.log(fib(3)' +
      ');\\n});\\n\\n\\n//# sourceURL=webpack:///./index.js?");\n\n/***/ })\n\n/******/' +
      ' });',
  '0.main.js': '(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],{\n\n/***/ "./' +
      'fib.js":\n/*!****************!*\\\n  !*** ./fib.js ***!\n  \\****************/\n' +
      '/*! exports provided: default */\n/***/ (function(module, __webpack_exports__, _' +
      '_webpack_require__) {\n\n"use strict";\neval("__webpack_require__.r(__webpack_ex' +
      'ports__);\\n/* harmony default export */ __webpack_exports__[\\"default\\"] = (f' +
      'unction(n) {\\n  return n + (n > 0 ? n - 1 : 0);\\n});;\\n\\n\\n//# sourceURL=we' +
      'bpack:///./fib.js?");\n\n/***/ }),\n\n/***/ "./obj.js":\n/*!****************!*\' +
      '\\n  !*** ./obj.js ***!\n  \\****************/\n/*! exports provided: key, fib *' +
      '/\n/***/ (function(module, __webpack_exports__, __webpack_require__) {\n\n"use s' +
      'trict";\neval("__webpack_require__.r(__webpack_exports__);\\n/* harmony export (' +
      'binding) */ __webpack_require__.d(__webpack_exports__, \\"key\\", function() { r' +
      'eturn key; });\\n/* harmony import */ var _fib__WEBPACK_IMPORTED_MODULE_0__ = __' +
      'webpack_require__(/*! ./fib */ \\"./fib.js\\");\\n/* harmony reexport (safe) */ ' +
      '__webpack_require__.d(__webpack_exports__, \\"fib\\", function() { return _fib__' +
      'WEBPACK_IMPORTED_MODULE_0__[\\"default\\"]; });\\n\\n\\nlet key = \'obj\';\\n\\n' +
      '\\n\\n//# sourceURL=webpack:///./obj.js?");\n\n/***/ })\n\n}]);'
},
warnings : [],
