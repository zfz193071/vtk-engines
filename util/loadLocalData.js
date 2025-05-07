/*
 * @Author: 
 * @Date: 2023-11-22 22:03:10
 * @LastEditTime: 2023-12-27 17:55:50
 * @LastEditors: ssy
 * @Description: 
 */
import SeriesInfo from "./tSeriesInfo.js"
const DATAPOOR = {
    "headerCT-61": {
        name: "headerCT-61",
        length: 61,
        dirPath: "../public/data/headerCT-61/",
    },
    "headerCT-165": {
        name: "headerCT-165",
        length: 165,
        dirPath: "../public/data/headerCT-165/",
        mark:"一脉西安 HanMeiLing slug:45865"
    },
    "headerMR-26": {
        name: "headerMR-26",
        length: 26,
        dirPath: "../public/data/headerMR-26/",
        mark:"磁共振异常数据 api.cms PMR000483 slug:53705"
    },
}


class LocalData {
    SeriesInfo = null
    Para = {//用于初始化一个vtk渲染对象
        size: [400, 400, 400],
        pixcelSpacing: [3, 3, 3],
        sizeInData: [200, 200, 200],
        leftTopOfData: [10, 10, 10],
        oriInData: [330, 330, 330],
        origin: [],
        dataBuf: [],

        baseValus: 100,
        maxValus: 1000,

    }
}
const LOCALDATA = {
    async getLocalData(key) {
        let dataPara = DATAPOOR[key]
        let firstDataset = await this.dicomParser_loadSingleData(1, dataPara.dirPath)
        let volumeBuf = this.getInitVolumeBuf(firstDataset, dataPara.length)
        console.log("原始图像的第一张是脚,在获取是数据的时候倒过来一下，变成第一张是头")
        let seriesInfo = this.initSeriesInfo(volumeBuf,firstDataset, dataPara.length)

        for (let i = 2; i <= dataPara.length; i++) {
            let dataSet= await this.dicomParser_loadSingleData(i, dataPara.dirPath)
            this.updateSeriesInfo(volumeBuf,dataSet,i,seriesInfo, dataPara.length)
        }
        //对serresInfo进行处理
        seriesInfo = seriesInfo.getInitMode(seriesInfo)
        seriesInfo=seriesInfo.getInitResize(seriesInfo)
        seriesInfo=seriesInfo.delUnUsedInfo(seriesInfo)
        
        let localDataResp = new LocalData()
        localDataResp.SeriesInfo = seriesInfo
        localDataResp.Para = {
            name: key,
            size:[ seriesInfo.volumeSize[0].w, seriesInfo.volumeSize[0].h, seriesInfo.volumeSize[0].d],
            pixcelSpacing:[ seriesInfo.pixelSpacing[0].w, seriesInfo.pixelSpacing[0].h, seriesInfo.pixelSpacing[0].d],
            origin: [seriesInfo.leftTopOfVolumeOnWorld.x, seriesInfo.leftTopOfVolumeOnWorld.y, seriesInfo.leftTopOfVolumeOnWorld.z],
            initVolumeBuf: volumeBuf,
            dataType: volumeBuf.BYTES_PER_ELEMENT === 2 ? vtk.Common.Core.vtkDataArray.VtkDataTypes.SHORT : vtk.Common.Core.vtkDataArray.VtkDataTypes.FLOAT,
            BlendMode: 1,
            colormapIndex: 'B&W',
            opacity: 1,
            ww: 2000,
            wl: 1000,
        }
        return localDataResp
    },

    //从dataSet中提取数据需要的数据
    formateDataset(dataSet) {
        //tag 都用首字母大写
        let PixelData = dataSet.elements.x7fe00010;

        
        let BitsStored = dataSet.uint16("x00280101");
        let Rows = dataSet.int16("x00280010");  
        let Columns = dataSet.int16("x00280011"); 
        let RescaleSlope = dataSet.floatString("x00281053") ? dataSet.floatString("x00281053") : 1;
        let RescaleIntercept = dataSet.floatString("x00281052") ? dataSet.floatString("x00281052") : 0;
        let SOPInstanceUID = dataSet.string("x00080018")
        let SliceThickness = dataSet.floatString("x00180050");
        let SpacingBetweenSlices = dataSet.floatString("x00180088");

        let ImagePositionPatientStr = dataSet.string("x00200032");
        let ImagePositionPatientArr = ImagePositionPatientStr.split('\\');
        let ImagePositionPatient = { x: Number(ImagePositionPatientArr[0]), y: Number(ImagePositionPatientArr[1]), z: Number(ImagePositionPatientArr[2]) }
        
        let ImageOrientationPatientStr = dataSet.string("x00200037");
        let ImageOrientationPatient = ImageOrientationPatientStr.split('\\');

        //转成数字
              
        let PixelSpacingStr = dataSet.string("x00280030");
        let PixelSpacing = PixelSpacingStr.split('\\');
        ImageOrientationPatient.forEach(element => {
            element = Number(element)
        });

        let Modality = dataSet.string("x00080060");
        let PixelRepresentation = dataSet.uint16("x00280103")

        let PatientName = dataSet.string("x00100010");
        let PatientID = dataSet.string("x00100020");
        return {
            PixelData,
            BitsStored,
            Rows,  //height
            Columns,  //width
            RescaleSlope,
            RescaleIntercept,
            SOPInstanceUID,
            SliceThickness,
            SpacingBetweenSlices,
            ImagePositionPatient,  //{x:1,y:1,z"1}
            ImageOrientationPatient, //[1,0,0,0,1,0]
            PixelSpacing, //[1,1]
            Modality,
            PixelRepresentation,
            PatientName,
            PatientID
        }
    },
    updateSeriesInfo(volumeBuf,dataSet,index,seriesInfo, sizeDepth){
        let {ImagePositionPatient,ImageOrientationPatient} = this.formateDataset(dataSet)
        seriesInfo.ImagePositionPatient[sizeDepth-index-1] = ImagePositionPatient
        seriesInfo.ImageOrientationPatient[sizeDepth-index-1] = ImageOrientationPatient
        this.setPixelData(volumeBuf, sizeDepth-index, dataSet)
    },
    initSeriesInfo(volumeBuf,dataSet, sizeDepth) {
        let resp = this.formateDataset(dataSet)
        console.log(resp.PatientID,resp.PatientName)
        let arr1= []
        let arr2 =[]
        arr1[sizeDepth-1]=resp.ImagePositionPatient
        arr2[sizeDepth-1]=resp.ImageOrientationPatient
        let {Modality,Columns,Rows,PixelSpacing} = resp
        let seriesInfo = new SeriesInfo({
            imageSize: [Columns, Rows, sizeDepth],
            PixelSpacing,
            ImagePositionPatient: arr1,
            ImageOrientationPatient: arr2,
            Modality
        })

        this.setPixelData(volumeBuf, sizeDepth-1, dataSet)
        return seriesInfo
    },
    getInitVolumeBuf(dataSet, sizeDepth) {
        let volumeBuf
        let {Modality,Columns,Rows,} = this.formateDataset(dataSet)
        let volumeLength = Columns * Rows * sizeDepth
        if(Modality==="PT"||Modality==="NM"){
            volumeBuf = new Float32Array(volumeLength)
        }else{
            volumeBuf = new Int16Array(volumeLength)
        }
        return volumeBuf
    },
    setPixelData(volumeBuf, index, dataSet) {
        let {PixelData,Columns,Rows,PixelRepresentation,RescaleIntercept,RescaleSlope} = this.formateDataset(dataSet)
        let formatePixelData = null
        if(PixelRepresentation === 1){
            formatePixelData = new Int16Array(dataSet.byteArray.buffer, PixelData.dataOffset, PixelData.length / 2);
        }else{
            formatePixelData = new Uint16Array(dataSet.byteArray.buffer, PixelData.dataOffset, PixelData.length / 2);
        }
        let dataLength = Columns * Rows;
        let offset = (index - 1) * dataLength
        for (let i = 0; i < dataLength; i++) {//最后存入的值会由volumeBuf被初始化的时候选择的类型决定
            volumeBuf[i + offset] =  RescaleSlope *formatePixelData[i]+RescaleIntercept
        }
    },
    dicomParser_loadSingleData(index, dirPath) {
        let url = `${dirPath}${index}.dcm`
        console.log(`load ${url}`)
        return new Promise((resolve, reject) => {
            axios.get(url, { responseType: "arraybuffer" }).then((resp) => {
                let dataArr = new Uint8Array(resp.data)
                let dataSet = dicomParser.parseDicom(dataArr);
                resolve(dataSet)
            }).catch((err) => {
                console.log(err)
                reject(err)
            })
        })

    }
}

export default LOCALDATA