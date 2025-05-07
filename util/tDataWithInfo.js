/*
 * @Author: 
 * @Date: 2023-11-22 15:00:22
 * @LastEditTime: 2023-11-22 21:11:33
 * @LastEditors: ssy
 * @Description: 
 */
class DataWithInfo {
    constructor(paraInit) {
        let keys = Object.keys(paraInit)
        keys.forEach(key=>{
            this[key] = paraInit[key]
        })
    }

    pixelSpacingW = 1
    pixelSpacingH = 1
    pixelSpacingD = 1
    leftTopPos = { wA: 0, hA: 0, dA: 0 } //当前图像左上角的绝对坐标，用宽，高，深定义
    origBuf = {
        with: 1,
        height: 1,
        data: new Int16Array(1),
        isColor: false
    }//原始数据
    curViewMod=0
}

export default DataWithInfo;