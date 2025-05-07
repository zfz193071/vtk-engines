// This script will load the WebWorkers and Codecs from unpkg url
// let path = require('path')
// let webWorkerUrl = path.join(__dirname, './static/cornerstoneWADOImageLoaderWebWorker.min.js')
let webWorkerUrl = './js/cornerstoneWADOImageLoaderWebWorker.min.js'
let codecsUrl = './cornerstoneWADOImageLoaderCodecs.js'
try {
  window.cornerstoneWADOImageLoader.webWorkerManager.initialize({
    maxWebWorkers: 4,
    startWebWorkersOnDemand: true,
    webWorkerPath: webWorkerUrl,
    webWorkerTaskPaths: [],
    taskConfiguration: {
      decodeTask: {
        loadCodecsOnStartup: true,
        initializeCodecsOnStartup: false,
        codecsPath: codecsUrl,
        usePDFJS: false,
        strict: false
      }
    }
  });
} catch (error) {
  throw new Error('cornerstoneWADOImageLoader is not loaded');
}

