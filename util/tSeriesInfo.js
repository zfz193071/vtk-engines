/*
 * @Author: 
 * @Date: 2023-11-22 17:02:45
 * @LastEditTime: 2023-11-23 17:28:03
 * @LastEditors: ssy
 * @Description: 
 */
class SeriesInfo {
    constructor(paraInit) {
        let keys = Object.keys(paraInit)
        keys.forEach(key => {
            this[key] = paraInit[key]
        })
    }
    //求原始图像的视图
    getInitMode(series) {
        let imgorient = { ...series.ImageOrientationPatient[0] }
        let curViewMod = 0
        let modeDic = [2, 1, 0] //横断面 2-0, 冠状面1-0,矢状面 0-0
        let min = 2,
            minAx = 0
        for (let i = 0; i < 3; i++) {
            let temp = Math.abs(imgorient[i]) + Math.abs(imgorient[i + 3])
            if (temp < min) {
                min = temp
                minAx = i
            }
        }
        curViewMod = modeDic[minAx]
        series.initViewMod = curViewMod
        series.curViewMod = series.initViewMod
        let flag = 0
        for (let i = 0; i < 6; i++) {
            imgorient[i] = Math.round(imgorient[i] * 10000) / 10000
            if (imgorient[i] != 0) {
                flag++
            }
        }
        if (flag > 2) {
            series.ifAngle = true
        }

        let imageDirection = [{
            directionMap: { row: ["R", "L"], column: ["A", "P"] } //横断面
        },
        {
            directionMap: { row: ["R", "L"], column: ["S", " I"] } //冠状面
        },
        {
            directionMap: { row: ["A", "P"], column: ["S", " I"] } //矢状面
        }
        ]
        series.imageDirection = imageDirection
        return series
    }
    getInitResize(series) {
        let {
            initViewMod, PixelSpacing, SliceThickness,SpacingBetweenSlices, imageSize,ImagePositionPatient
        } = series
        let leftTopOfVolumeOnWorld={...ImagePositionPatient[0]}, centerOfVolumeOnWorld
        
        //层厚
        let xPixelSpacing = Number(PixelSpacing[0]),yPixelSpacing = Number(PixelSpacing[1])
        let zPixelSpacing = SpacingBetweenSlices?SpacingBetweenSlices:SliceThickness?SliceThickness:null

        //orgT 是原始层厚，thickness是渲染的时候会被用到的层厚，有的时候会被改
        let thickness = 1
        if (initViewMod === 0) {
            if(!zPixelSpacing){
                zPixelSpacing = Math.abs(ImagePositionPatient[0].z - ImagePositionPatient[ImagePositionPatient.length-1].z)/imageSize[2]
            }
            thickness=Math.max([xPixelSpacing, yPixelSpacing, zPixelSpacing])
            series.pixelSpacing = [
                { w: xPixelSpacing, h: yPixelSpacing, d: zPixelSpacing, orgT: zPixelSpacing, thickness: thickness },
                { w: xPixelSpacing, h: zPixelSpacing, d: yPixelSpacing, orgT: zPixelSpacing, thickness: thickness },
                { w: yPixelSpacing, h: zPixelSpacing, d: xPixelSpacing, orgT: zPixelSpacing, thickness: thickness }
            ]
            series.volumeSize = [
                { w: imageSize[0], h: imageSize[1], d: imageSize[2] },
                { w: imageSize[0], h: imageSize[2], d: imageSize[1] },
                { w: imageSize[1], h: imageSize[2], d: imageSize[0] }
            ]
            centerOfVolumeOnWorld = {
                x:leftTopOfVolumeOnWorld.x+ series.volumeSize[0].w/2*series.pixelSpacing[0].w,
                y:leftTopOfVolumeOnWorld.y+ series.volumeSize[0].h/2*series.pixelSpacing[0].h,
                z:leftTopOfVolumeOnWorld.z- series.volumeSize[0].d/2*series.pixelSpacing[0].d
            }
        }

        if (initViewMod === 1) {  //[xPixelSpacing-x yPixelSpacing-z zPixelSpacing-y]冠状面转横断面
            if(!zPixelSpacing){
                zPixelSpacing = Math.abs(ImagePositionPatient[0].y - ImagePositionPatient[ImagePositionPatient.length-1].y)/imageSize[2]
            }
            thickness=Math.max([xPixelSpacing, yPixelSpacing, zPixelSpacing])
            series.pixelSpacing = [
                { w: xPixelSpacing, h: zPixelSpacing, d: yPixelSpacing, orgT: zPixelSpacing, thickness: thickness },
                { w: xPixelSpacing, h: yPixelSpacing, d: zPixelSpacing, orgT: zPixelSpacing, thickness: thickness },
                { w: zPixelSpacing, h: yPixelSpacing, d: xPixelSpacing, orgT: zPixelSpacing, thickness: thickness }
            ]
            series.volumeSize = [
                { w: imageSize[0], h: imageSize[2], d: imageSize[1] },
                { w: imageSize[0], h: imageSize[1], d: imageSize[2] },
                { w: imageSize[2], h: imageSize[1], d: imageSize[0] }
            ]
            centerOfVolumeOnWorld = {
                x:leftTopOfVolumeOnWorld.x+ series.volumeSize[1].w/2*series.pixelSpacing[1].w,
                y:leftTopOfVolumeOnWorld.z- series.volumeSize[1].h/2*series.pixelSpacing[1].h,
                z:leftTopOfVolumeOnWorld.y+ series.volumeSize[1].d/2*series.pixelSpacing[1].d
            }
        }

        if (initViewMod === 2) {//[xPixelSpacing-y yPixelSpacing-z zPixelSpacing-x]矢状面转横断面
            if(!zPixelSpacing){
                zPixelSpacing = Math.abs(ImagePositionPatient[0].x - ImagePositionPatient[ImagePositionPatient.length-1].x)/imageSize[2]
            }
            thickness=Math.max([xPixelSpacing, yPixelSpacing, zPixelSpacing])
            series.pixelSpacing = [
                { w: zPixelSpacing, h: xPixelSpacing, d: yPixelSpacing, orgT: zPixelSpacing, thickness: thickness },
                { w: zPixelSpacing, h: yPixelSpacing, d: xPixelSpacing, orgT: zPixelSpacing, thickness: thickness },
                { w: xPixelSpacing, h: yPixelSpacing, d: zPixelSpacing, orgT: zPixelSpacing, thickness: thickness }
            ]
            series.volumeSize = [
                { w: imageSize[2], h: imageSize[0], d: imageSize[1] },
                { w: imageSize[2], h: imageSize[1], d: imageSize[0] },
                { w: imageSize[0], h: imageSize[1], d: imageSize[2] }
            ]
            centerOfVolumeOnWorld = {
                x:leftTopOfVolumeOnWorld.y+ series.volumeSize[2].w/2*series.pixelSpacing[2].w,
                y:leftTopOfVolumeOnWorld.z- series.volumeSize[2].h/2*series.pixelSpacing[2].h,
                z:leftTopOfVolumeOnWorld.x+ series.volumeSize[2].d/2*series.pixelSpacing[2].d
            }
        }
        series.leftTopOfVolumeOnWorld = leftTopOfVolumeOnWorld
        series.centerOfVolumeOnWorld = centerOfVolumeOnWorld
        return series
    }

    delUnUsedInfo(series) {
        //删除序列中的分辨率和宽高信息的xPixelSpacing,yPixelSpacing,zPixelSpacing,thickness
        try {
            delete series.xPixelSpacing
            delete series.yPixelSpacing
            delete series.zPixelSpacing
            delete series.thickness
            delete series.rescaleSlope
            delete series.pngWidth
            delete series.pngHeight
            delete series.imageSize
            delete series.SliceLocation
        } catch (error) {
        }
        return series
    }
}

const defaultPara = {
    //dicom四角显示的必要信息，从第一张image中获取,初始化series的的时候就要有
    "thumbImage": "",
    "study_id": "",
    "currentSID": "",
    "SeriesIndex": "",
    "TransferSyntaxUID": "1.2.840.10008.1.2.1",
    "model": "CT",
    "parts": "WHOLEBODY",
    "manufacturer": "UIH",
    "manufacturerModelName": "",
    "institutionName": "",
    "description": "",
    "StudyDate": "",
    "SeriesDate": "",
    "PatientSex": "",
    "PatientAge": "",
    "PatientID": "",
    "PatientName": "",
    "PatientWeight": "",
    "SID": 1,
    "RadionuclideTotalDose": null,
    "DoseCalibrationFactor": null,
    "AcquisitionTime": "105645.000000",
    "RadiopharmaceuticalStartTime": null,
    "RadionuclideHalfLife": null,
    "Units": null,
    // "samplesPerPixel":"1",  废弃
    //"bitsAllocated":"16", 废弃
    //"bitsStored":16,废弃
    //"highBit":15,废弃
    //"pixelPaddingValue":0,废弃

    //用于校验数据合法性，但是只取第一张存储的数据
    "pixelRepresentation": 0,
    "imageOrientation": [0.9848, 0.1736, 0, -0.1736, 0.9848, 0],
    "RescaleType": "HU",
    //"pngType":null,废弃

    //用于加载、提前分配Volume和判断是否加载完毕，需要在解析dicom之前就获取到
    "paths": [],
    "pngPaths": [],
    "volumeSize": [],


    //用于判断是否从前置机读取数据
    "testLocal": null,
    "getLocalData": null,

    //每一张image都需要单独存储,在解析DICOM的时候获取
    "wwwls": [],
    "rescaleSlopes": [],
    "rescaleIntercepts": [],
    "ImagePositionPatient": [{ "x": -121.381, "y": -173.4754, "z": 1757.6721 }],

    //后台传过来用于初始化的数据
    "xPixelSpacing": 1,
    "yPixelSpacing": 1,
    "zPixelSpacing": 1,
    "imageSize": [512, 512, 159],

    //在数据都加载完成之后，需要校验并获取
    //"ww":80,  废弃
    //"wl":35,  废弃
    "initViewMod": 0,
    "curViewMod": 0,
    "ifAngle": true,
    "imageDirection": [{ "directionMap": { "row": ["R", "L"], "column": ["A", "P"] } }, { "directionMap": { "row": ["R", "L"], "column": ["S", " I"] } }, { "directionMap": { "row": ["A", "P"], "column": ["S", " I"] } }],
    "sliceCheckCode": 0,
    "dynamic": { "ww": 2443, "wl": 197.5 },
    "pixelSpacing": [{ "w": 0.5859375, "h": 0.5859375, "d": 1.5, "orgT": 1.5, "thickness": 1.5 }, { "w": 0.5859375, "h": 1.5, "d": 0.5859375, "orgT": 1.5, "thickness": 1.5 }, { "w": 0.5859375, "h": 1.5, "d": 0.5859375, "orgT": 1.5, "thickness": 1.5 }],
    "volumeSize": [{ "w": 512, "h": 512, "d": 159 }, { "w": 512, "h": 159, "d": 512 }, { "w": 512, "h": 159, "d": 512 }],
}

export default SeriesInfo;