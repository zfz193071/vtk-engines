/*
 * @Author: 
 * @Date: 2023-09-11 15:25:25
 * @LastEditTime: 2023-11-24 13:12:13
 * @LastEditors: ssy
 * @Description: 
 */

import SeriesInfo from "./tSeriesInfo.js"
class CubeDataClass {
    constructor(paraInit) {
        let Para = {
            size:[800,800,800],
            pixcelSpacing:[3,3,3],
            sizeInData:[500,500,500],
            leftTopOfData:[10,10,10],
            oriInData:[330,330,330],
            origin:[],
            initVolumeBuf :[],
            ww: 5000,
            wl:2000,
            baseValus: 100,
            maxValus: 5000,
            BlendMode:1,
            colormapIndex: 'PET',
            opacity:0.9
        }
        Para = {...Para,...paraInit}
        
        
        Para.origin = [
            Para.oriInData[0] - Para.leftTopOfData[0]* Para.pixcelSpacing[0] ,
            Para.oriInData[1] - Para.leftTopOfData[1] * Para.pixcelSpacing[1] ,
            Para.oriInData[2] - Para.leftTopOfData[2] * Para.pixcelSpacing[2] 
        ]
        
        Para.centerWorld = [
            Para.origin[0]+Para.size[0]/2*Para.pixcelSpacing[0],
            Para.origin[1]+Para.size[1]/2*Para.pixcelSpacing[1],
            Para.origin[2]+Para.size[2]/2*Para.pixcelSpacing[2]
        ] 
        
        Para.initVolumeBuf = new Int16Array(Para.size[0]*Para.size[1]*Para.size[2])
        
        
        Para.centetPoint = {
            x:Para.leftTopOfData[0]+Para.sizeInData[0]/2,
            y:Para.leftTopOfData[1]+Para.sizeInData[1]/2,
            z:Para.leftTopOfData[2]+Para.sizeInData[2]/2,
        }
        Para.lenAxis = {
            x:Para.sizeInData[0]/2,
            y:Para.sizeInData[1]/2,
            z:Para.sizeInData[2]/2
        }

        //赋值pt
        for(let i=0;i<Para.size[0]*Para.size[1]*Para.size[2];i++){
            if(i%2){
                Para.initVolumeBuf[i]= Para.baseValus
            }
        }
        for(let k=Para.leftTopOfData[2];k<Para.leftTopOfData[2]+Para.sizeInData[2];k++){
            for(let j=Para.leftTopOfData[1];j<Para.leftTopOfData[1]+Para.sizeInData[1];j++){
                for(let i=Para.leftTopOfData[0];i<Para.leftTopOfData[0]+Para.sizeInData[0];i++){
                    if(this.isPointInEllipse(i,j,k,Para.centetPoint,Para.lenAxis)){
                        Para.initVolumeBuf[i*Para.size[1]*Para.size[2]+j*Para.size[2]+k] = 200+Para.maxValus*2*(Math.abs(k-Para.leftTopOfData[2]-Para.sizeInData[2]/2)/Para.sizeInData[2])
                    }else{
                        Para.initVolumeBuf[i*Para.size[1]*Para.size[2]+j*Para.size[2]+k] =200+ Para.maxValus/10
                    }
                }
            }
        }
        
        this.Para = Para

        this.SeriesInfo = new SeriesInfo({
            initViewMod:0,
            imageSize:[Para.size[0],Para.size[1],Para.size[2]],
            PixelSpacing:[Para.pixcelSpacing[0],Para.pixcelSpacing[1],Para.pixcelSpacing[2]],
            ImagePositionPatient:[{x:Para.origin[0],y:Para.origin[1],z:Para.origin[2]}],
        })
        for(let i=1;i<Para.size[2];i++){
          this.SeriesInfo.ImagePositionPatient.push({
            x:this.SeriesInfo.ImagePositionPatient[0].x,
            y:this.SeriesInfo.ImagePositionPatient[0].y,
            z:this.SeriesInfo.ImagePositionPatient[0].z-i*this.SeriesInfo.PixelSpacing[2]
          })
        }
        this.SeriesInfo = this.SeriesInfo.getInitResize(this.SeriesInfo)
        this.SeriesInfo = this.SeriesInfo.delUnUsedInfo(this.SeriesInfo)
    }
      /**
     * @description: 判断点是否在椭球内部
     * @param {*} point
     * @param {*} minCube
     * @return {*}
     */    
    isPointInEllipse(i,j,k,centerPoint,lenAxis){
        // 计算点到椭球中心的距离
        var distance =
            Math.pow((i - centerPoint.x) / lenAxis.x, 2) +
            Math.pow((j - centerPoint.y) / lenAxis.y, 2) +
            Math.pow((k - centerPoint.z) / lenAxis.z, 2);
        
        // 判断点是否在椭球内部
        if (distance <= 1) {
            return true;
        } else {
            return false;
        }
    }
}

export default CubeDataClass;