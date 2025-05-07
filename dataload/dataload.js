cornerstoneWADOImageLoader.external.cornerstone = cornerstone
cornerstoneFileImageLoader.external.cornerstone = cornerstone
cornerstone.imageCache.setMaximumSizeBytes(10000000);  //单位Bytes，当前设定值10M
cornerstoneWADOImageLoader.configure({
    beforeSend: function (xhr) {
        // xhr.setRequestHeader("Cache-Control", 'max-age=60');//测试前端设置缓存，但是没啥用
    }
})

let dirList =
    [
        "6352aa014e682b477fc33d09",//884张磁共振
        "6352a8314e682b477fc2a4ff",//884张磁共振
        "6352a8754e682b477fc2bac5",//CT
    ]

let pathPrefix = "http://127.0.0.1:6010/public/DICOM/"

let path = dirList[0]
let imageList = []

function cornerstoneFile_loadSingleData(index, max) {
    let url = `${pathPrefix}${path}/${index}.dcm`
    axios.get(url, { responseType: "arraybuffer" }).then((resp) => {
        console.log(resp.data)
        let dataArr = new Uint8Array(resp.data)
        let imageId = cornerstoneFileImageLoader.fileManager.addBuffer(resp.data);
        cornerstone.loadImage(imageId).then(function (image) {
            cornerstone.displayImage(element, image);
        }).catch((err) => {
            console.log(err)
        })
    }).catch((err) => {
        console.log(err)
    })
}


// let indexStart = 1, maxIndex = 884 + 1
function daikon_loadSingleData(index, max) {
    let url = `${pathPrefix}${path}/${index}.dcm`
    axios.get(url, { responseType: "arraybuffer" }).then((resp) => {
        console.time(`daikon:${index - 1}`)
        var daikonImage = daikon.Series.parseImage(new DataView(resp.data));
        var daikonData = daikonImage.getInterpretedData(false, true)
        let data = new Int16Array(daikonData.data)
        let origBuf = { width: daikonData.numRows, height: daikonData.numCols, data: data, length: daikonData.data.length, max: daikonData.max, min: daikonData.min }
        daikonData = null
        imageList[index - 1] = origBuf
        console.timeEnd(`daikon:${index - 1}`)
        if (index + 1 <= max) {
            daikon_loadSingleData(index + 1, max)
        }
    }).catch((err) => {
        console.log(err)
    })
}



function testDaikon() {
    for (let i = 0; i < 4; i++) {
        daikon_loadSingleData(200 * i + 1, 200 * (i + 1))
    }
    daikon_loadSingleData(801, 884)
}


function cornerstone_loadSingleData(index, max) {
    let url = "wadouri:" + `${pathPrefix}${path}/${index}.dcm`
    cornerstone.loadImage(url).then((image) => {
        // let data = image.getPixelData()
        let { intercept, slope, width: dataWidth, height: dataHeight } = image
        // let max1 = slope * image.maxPixelValue + intercept
        // let min1 = slope * image.minPixelValue + intercept
        // imageList[index - 1] = { width: dataWidth, height: dataHeight, data: data, length: data.length, max: max1, min: min1 }        
        console.log(intercept, slope, dataWidth, dataHeight)
        if (index + 1 <= max) {
            cornerstone_loadSingleData(index + 1, max)
        }

    })
}
function testCornerstone() {
    for (let i = 0; i < 4; i++) {
        cornerstone_loadSingleData(200 * i + 1, 200 * (i + 1))
    }
    cornerstone_loadSingleData(801, 884)
}

// cornerstone_loadSingleData(1, 1)

testCornerstone()

function dicomParser_loadSingleData(index, max) {
    let url = `${pathPrefix}${path}/${index}.dcm`
    axios.get(url, { responseType: "arraybuffer" }).then((resp) => {
        let dataArr = new Uint8Array(resp.data)
        let dataSet = dicomParser.parseDicom(dataArr);
        let dataWidth = dataSet.int16("x00280010")
        let dataHeight = dataSet.int16("x00280011")
        let slope = dataSet.floatString("x00281053") ? dataSet.floatString("x00281053") : 1
        let intercept = dataSet.floatString("x00281052") ? dataSet.floatString("x00281052") : 0
        console.log(dataWidth, dataHeight, slope, intercept)
        var pixelDataElement = dataSet.elements.x7fe00010;
        var pixelData = new Uint16Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length / 2);
        dataArr = null
        dataSet = null
        // pixelData = null
        imageList[index - 1] = { width: dataWidth, height: dataHeight, data: pixelData }
        if (index + 1 <= max) {
            dicomParser_loadSingleData(index + 1, max)
        }
    }).catch((err) => {
        console.log(err)
    })
}
function testDicomParser() {
    for (let i = 0; i < 4; i++) {
        dicomParser_loadSingleData(200 * i + 1, 200 * (i + 1))
    }
    dicomParser_loadSingleData(801, 884)
}


function loadSingleData(index, max) {
    let url = `${pathPrefix}${path}/${index}.dcm`
    axios.get(url, { responseType: "arraybuffer" }).then((resp) => {
        for (let i = 0; i < 5; i++) {
            let test = new Int16Array(1024 * 1024)
        }

        if (index + 1 <= max) {
            loadSingleData(index + 1, max)
        }
    }).catch((err) => {
        console.log(err)
    })
}
function justLoad() {
    for (let i = 0; i < 4; i++) {
        loadSingleData(200 * i + 1, 200 * (i + 1))
    }
    loadSingleData(801, 884)
}

// testDaikon()