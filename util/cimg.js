// 主要用于处理医学图像数据的渲染，包括单张图像的渲染以及多张图像的混合渲染
// 提供了一系列函数，用于设置窗宽窗位、插值处理和图像绘制等操作，最终将处理后的图像数据渲染到 HTML5 的 <canvas> 元素上

import COLORMAP from './colormap.js'
//定一个标准的图像宽
const N_WIDTH = 512
const CIMG = {
    getRenderCImg (orgData, colormapIndex, ww, wl, tagScale = undefined, canvasEle = undefined) {
        if (!canvasEle) {
            canvasEle = document.createElement("canvas")
        }
        let imageData = this.getRenderData(orgData, colormapIndex, ww, wl, tagScale)
        canvasEle = this.getCimgFromRdata(canvasEle, imageData)
        return canvasEle
    },
    getCimgFromRdata (canvasEle, imageData) {

        let interCImg
        if (!canvasEle.interCImg) {
            interCImg = document.createElement("canvas")
            canvasEle.interCImg = interCImg
        } else {
            interCImg = canvasEle.interCImg
            interCImg.width = 0
            interCImg.height = 0
        }

        //在这里设置缩放倍数
        if (imageData.scale_self) {
            interCImg.width = imageData.width
            interCImg.height = imageData.height
            let interCImg_ctx = interCImg.getContext('2d')
            interCImg_ctx.putImageData(imageData, 0, 0)
            canvasEle.width = imageData.width / imageData.scale_self.x
            canvasEle.height = imageData.height / imageData.scale_self.y
            canvasEle.ifInterPro = true

        } else {
            canvasEle.width = imageData.width
            canvasEle.height = imageData.height
            let ctx = canvasEle.getContext('2d')
            ctx.putImageData(imageData, 0, 0)
            canvasEle.ifInterPro = undefined
        }
        return canvasEle
    },
    getRenderData (orgData, colormapIndex, ww, wl, tagScale = undefined) {
        let imageData = undefined, scale_self = undefined
        if (tagScale && tagScale.x && tagScale.y) {//只有传了目标缩放的倍数才插值
            if (orgData.width == orgData.height) {
                if (orgData.width < N_WIDTH) {//两个方向都需要插值，只适用于横断面分辨率不够的图像
                    if (tagScale.x >= 4) { //x,y同时四倍插值
                        scale_self = { x: 4, y: 4 }
                        imageData = this.setWWWL_interBothXY(orgData, colormapIndex, ww, wl, 4)
                    } else if (tagScale.x >= 2) {//x,y同时两倍插值
                        scale_self = { x: 2, y: 2 }
                        imageData = this.setWWWL_interBothXY(orgData, colormapIndex, ww, wl, 2)
                    }
                }
            } else if (orgData.width >= orgData.height && orgData.height < N_WIDTH && tagScale.x >= 1) {//只给y方向插值,解决层厚过厚的图像缩放效果不好的问题
                if (tagScale.x * 4 < tagScale.y) {//y方向四倍插值
                    scale_self = { x: 1, y: 4 }
                    imageData = this.setWWWL_interY(orgData, colormapIndex, ww, wl, 4)
                } else if (tagScale.x * 2 < tagScale.y) {//y方向两倍插值
                    scale_self = { x: 1, y: 2 }
                    imageData = this.setWWWL_interY(orgData, colormapIndex, ww, wl, 2)
                }
            } else if (orgData.width < orgData.height && orgData.width < N_WIDTH && tagScale.y >= 1) {//只给x方向插值,解决层厚过厚的图像缩放效果不好的问题
                if (tagScale.y * 4 < tagScale.x) {//x方向四倍插值
                    scale_self = { x: 4, y: 1 }
                    imageData = this.setWWWL_interX(orgData, colormapIndex, ww, wl, 4)
                } else if (tagScale.y * 2 < tagScale.x) {//x方向两倍插值
                    scale_self = { x: 2, y: 1 }
                    imageData = this.setWWWL_interX(orgData, colormapIndex, ww, wl, 2)

                }
            }
        }
        if (!imageData) {//直接调窗
            imageData = this.setWWWL(orgData, colormapIndex, ww, wl)
        }
        //把缩放倍数传过去
        if (scale_self) {
            imageData.scale_self = scale_self
        }
        return imageData
    },
    getMixRenderCImg (renderDataCT, renderDataPT, scalePTtoCT, transPTtoCT, opacity, cImage = undefined, ctCImg = undefined, ptCImg = undefined) {
        if (!cImage) {
            cImage = document.createElement("canvas")
        }

        if (!ctCImg) {
            ctCImg = document.createElement("canvas")
            cImage.ctCImg = ctCImg
        }
        if (!ptCImg) {
            ptCImg = document.createElement("canvas")
            cImage.ptCImg = ptCImg
        }

        ctCImg = this.getCimgFromRdata(ctCImg, renderDataCT)
        ptCImg = this.getCimgFromRdata(ptCImg, renderDataPT)


        let _scalePTtoCT = { ...scalePTtoCT }, _transPTtoCT = { ...transPTtoCT }

        let interCImg
        if (!cImage.interCImg) {
            interCImg = document.createElement("canvas")
            cImage.interCImg = interCImg
        } else {
            interCImg = cImage.interCImg
            interCImg.width = 0
            interCImg.height = 0
        }

        //CT图像渲染
        cImage.ifInterPro = ctCImg.ifInterPro
        cImage.width = ctCImg.width
        cImage.height = ctCImg.height
        cImage.interCImg.width = ctCImg.interCImg.width
        cImage.interCImg.height = ctCImg.interCImg.height
        let targetForPT
        if (ctCImg.ifInterPro) {
            let ctx = cImage.interCImg.getContext("2d")
            ctx.clearRect(0, 0, ctCImg.interCImg.width, ctCImg.interCImg.height)
            ctx.drawImage(ctCImg.interCImg, 0, 0)
            //这里渲染参数会变换
            let scaleCT_self = { x: ctCImg.interCImg.width / ctCImg.width, y: ctCImg.interCImg.height / ctCImg.height }
            _scalePTtoCT.x = _scalePTtoCT.x * scaleCT_self.x
            _scalePTtoCT.y = _scalePTtoCT.y * scaleCT_self.y
            _transPTtoCT.x = _transPTtoCT.x * scaleCT_self.x
            _transPTtoCT.y = _transPTtoCT.y * scaleCT_self.y
            targetForPT = cImage.interCImg
        } else {
            let ctx = cImage.getContext("2d")
            ctx.clearRect(0, 0, ctCImg.width, ctCImg.height)
            ctx.drawImage(ctCImg, 0, 0)
            targetForPT = cImage
        }

        //PT图像渲染
        let ptImage
        if (ptCImg.ifInterPro) {
            ptImage = ptCImg.interCImg
            //这里渲染参数会变换
            let scalePT_self = { x: ptCImg.interCImg.width / ptCImg.width, y: ptCImg.interCImg.height / ptCImg.height }
            _scalePTtoCT.x = _scalePTtoCT.x / scalePT_self.x
            _scalePTtoCT.y = _scalePTtoCT.y / scalePT_self.y
        } else {
            ptImage = ptCImg
        }
        let ctx_target = targetForPT.getContext('2d')
        ctx_target.save()
        ctx_target.translate(_transPTtoCT.x, _transPTtoCT.y)
        ctx_target.scale(_scalePTtoCT.x, _scalePTtoCT.y)
        ctx_target.globalAlpha = opacity
        ctx_target.drawImage(ptImage, 0, 0)
        ctx_target.restore()
        return cImage
    },
    setPixelColor (imageDataArr, index, value, colorMap) {
        if (value != undefined) {
            imageDataArr[index * 4 + 3] = 255
            imageDataArr[index * 4] = colorMap[value][0]
            imageDataArr[index * 4 + 1] = colorMap[value][1]
            imageDataArr[index * 4 + 2] = colorMap[value][2]
        }
    },
    //窗宽窗位 预设 改变图像
    setWWWL (orgData, colormapIndex, ww, wl) {
        // console.time("setWWWL")
        let { width: imageWidth, height: imageHeight, data: dataBuf } = orgData
        let max = wl + ww / 2
        let min = wl - ww / 2
        let range = 255 / (max - min)
        let imageDataArr = new Uint8ClampedArray(dataBuf.length * 4)
        //强转数据得到0-255范围内的整数
        let value = new Uint8ClampedArray(1)
        let colorMap = COLORMAP[colormapIndex]
        for (let i = 0; i < dataBuf.length; i++) {
            value[0] = (dataBuf[i] - min) * range
            this.setPixelColor(imageDataArr, i, value[0], colorMap)
        }
        let imageData = new ImageData(imageDataArr, imageWidth, imageHeight)
        // console.timeEnd("setWWWL")
        return imageData
    },
    setWWWL_interX (orgData, colormapIndex, ww, wl, scaleX) {
        // console.time("setWWWL_interX")
        let { width, height, data: tempData } = orgData
        let max = wl + ww / 2
        let min = wl - ww / 2
        let range = 255 / (max - min)
        let imageDataArr = new Uint8ClampedArray(tempData.length * 4 * scaleX) //X方向的插值倍数
        //强转数据得到0-255范围内的整数
        let value = new Uint8ClampedArray(1)
        let dim = 1 / scaleX
        let colorMap = COLORMAP[colormapIndex]
        for (let j = 0; j < height; j++) {
            for (let i = 0; i < width - 1; i++) {
                for (let k = 0; k < scaleX; k++) {
                    let index = j * width * scaleX + i * scaleX + k
                    value[0] = ((tempData[j * width + i] * dim * (scaleX - k) + tempData[j * width + i + 1] * dim * k) - min) * range
                    this.setPixelColor(imageDataArr, index, value[0], colorMap)
                }
            }
        }
        for (let j = 0; j < height; j++) {//处理边界
            for (let k = 0; k < scaleX; k++) {
                let index = j * width * scaleX + width * scaleX - k - 1
                value[0] = ((tempData[j * width + width - 1]) - min) * range
                this.setPixelColor(imageDataArr, index, value[0], colorMap)
            }
        }
        let imageData = new ImageData(imageDataArr, width * scaleX, height)
        // console.timeEnd("setWWWL_interX")
        return imageData
    },
    setWWWL_interY (orgData, colormapIndex, ww, wl, scaleY) {
        // console.time("setWWWL_interY")
        let { width, height, data: tempData } = orgData
        let max = wl + ww / 2
        let min = wl - ww / 2
        let range = 255 / (max - min)
        let imageDataArr = new Uint8ClampedArray(tempData.length * 4 * scaleY) //X方向的插值倍数
        //强转数据得到0-255范围内的整数
        let value = new Uint8ClampedArray(1)
        let dim = 1 / scaleY
        let colorMap = COLORMAP[colormapIndex]
        for (let j = 0; j < height - 1; j++) {
            for (let i = 0; i < width; i++) {
                for (let k = 0; k < scaleY; k++) {
                    let index = (j * scaleY + k) * width + i
                    value[0] = ((tempData[j * width + i] * dim * (scaleY - k) + tempData[(j + 1) * width + i] * dim * k) - min) * range
                    this.setPixelColor(imageDataArr, index, value[0], colorMap)
                }
            }
        }
        for (let i = 0; i < width; i++) {//处理边界
            for (let k = 0; k < scaleY; k++) {
                let index = (height * scaleY - k - 1) * width + i
                value[0] = ((tempData[(height - 1) * width + i]) - min) * range
                this.setPixelColor(imageDataArr, index, value[0], colorMap)
            }
        }
        let imageData = new ImageData(imageDataArr, width, height * scaleY)
        // console.timeEnd("setWWWL_interY")
        return imageData
    },
    //注意这个函数一般用于PT插值，所以边界不处理以减少计算量
    setWWWL_interBothXY (orgData, colormapIndex, ww, wl, scale) {
        // console.time("setWWWL_interBothXY")
        let { width, height, data: tempData } = orgData
        let dataWidth = width * scale
        let dataHeight = height * scale
        let dataLength = dataWidth * dataHeight
        let max = wl + ww / 2
        let min = wl - ww / 2
        let range = 255 / (max - min)
        let imageDataArr = new Uint8ClampedArray(dataLength * 4) //X方向的插值倍数
        //强转数据得到0-255范围内的整数
        let value = new Uint8ClampedArray(1)
        let dim = 1 / scale
        let colorMap = COLORMAP[colormapIndex]
        //先进行行插值
        let newBuf = new Float32Array(dataLength)
        //先插值x方向
        for (let j = 0; j < height; j++) {
            for (let i = 0; i < width - 1; i++) {
                for (let k = 0; k < scale; k++) {
                    let index = j * scale * dataWidth + i * scale + k
                    newBuf[index] = (tempData[j * width + i] * dim * (scale - k) + tempData[j * width + i + 1] * dim * k)
                    value[0] = (newBuf[index] - min) * range
                    this.setPixelColor(imageDataArr, index, value[0], colorMap)
                }
            }
        }

        //再插值y方向
        for (let j = 0; j < height - 1; j++) {
            for (let i = 0; i < dataWidth; i++) {
                for (let k = 0; k < scale; k++) {
                    let index = (j * scale + k) * dataWidth + i
                    newBuf[index] = newBuf[j * scale * dataWidth + i] * dim * (scale - k) + newBuf[(j + 1) * scale * dataWidth + i] * dim * k
                    value[0] = (newBuf[index] - min) * range
                    this.setPixelColor(imageDataArr, index, value[0], colorMap)
                }
            }
        }
        let imageData = new ImageData(imageDataArr, dataWidth, dataHeight)
        // console.timeEnd("setWWWL_interBothXY")
        return imageData
    }
}

export default CIMG