/*
 * @Author: 
 * @Date: 2023-11-22 15:41:11
 * @LastEditTime: 2023-11-25 21:28:53
 * @LastEditors: ssy
 * @Description: 
 */
const LOAD = {
  $coordinateImageToCanvas(trans, rota, scale, imageWidth, imageHeight, canvasWidth, canvasHeigt, imagePoint) {
    var canvasPoint = { x: 0, y: 0 }
    var tempX
    var tempY

    // 换算到图像中心
    tempX = imagePoint.x - imageWidth / 2
    tempY = imagePoint.y - imageHeight / 2

    // 再做缩放
    tempX = tempX * scale.x
    tempY = tempY * scale.y

    // 再做旋转
    var degree = Math.atan2(tempX, tempY)
    var radius = Math.sqrt(tempX * tempX + tempY * tempY)
    tempX = radius * Math.sin(degree - rota)
    tempY = radius * Math.cos(degree - rota)

    // 图像中心和canvas中心重合
    canvasPoint.x = tempX + trans.x + canvasWidth / 2
    canvasPoint.y = tempY + trans.y + canvasHeigt / 2

    return canvasPoint;
  },
  $coordinateCanvasToImage(trans, rota, scale, imageWidth, imageHeight, canvasWidth, canvasHeigt, canvasPoint) {
    var imagePoint = { x: 0, y: 0 }
    var tempX = 0
    var tempY = 0

    var canvasCenter = { x: canvasWidth / 2 + trans.x, y: canvasHeigt / 2 + trans.y }

    // 此时，图像原点在canvas的中心
    imagePoint.x = canvasPoint.x

    imagePoint.y = canvasPoint.y

    // 原点逆时针转回原来的角度
    tempX = imagePoint.x - canvasCenter.x
    tempY = imagePoint.y - canvasCenter.y
    var degree = Math.atan2(tempX, tempY)
    var r = Math.sqrt((tempX) * (tempX) + tempY * tempY)

    // 所求点据中心点的x,y方向图像距离
    imagePoint.x = r * Math.sin(rota + degree) / scale.x
    imagePoint.y = r * Math.cos(rota + degree) / scale.y

    // 平移到以左上角为参考点的坐标
    imagePoint.x = Math.round(imagePoint.x + imageWidth / 2)
    imagePoint.y = Math.round(imagePoint.y + imageHeight / 2)
    return imagePoint
  },
  createDataArray(length, mode, isForceFloat = false){
    if (mode === 'PT' || isForceFloat) {
      return new Float32Array(length)
    }
    else {
      return new Int16Array(length)
    }
  },
    getFusionPara(dataWithInfo_ct, dataWithInfo_pt, curViewMod) {//这里是左上角的平移参数
  let scalePTtoCT = { x: 0, y: 0 }, transPTtoCT = { x: 0, y: 0 };
  scalePTtoCT = {
    x: dataWithInfo_pt.pixelSpacingW / dataWithInfo_ct.pixelSpacingW,
    y: dataWithInfo_pt.pixelSpacingH / dataWithInfo_ct.pixelSpacingH,
  };

  transPTtoCT = {
    x: (dataWithInfo_pt.leftTopPos.wA - dataWithInfo_ct.leftTopPos.wA) / dataWithInfo_ct.pixelSpacingW,
    y: (dataWithInfo_pt.leftTopPos.hA - dataWithInfo_ct.leftTopPos.hA) / dataWithInfo_ct.pixelSpacingH,
  };
  if (curViewMod != 0) {
    transPTtoCT.y = -transPTtoCT.y
  }
  return { scalePTtoCT, transPTtoCT }
},

getDataWithInfo(poor, seriesInfo, curViewMod, curImageNum) {
  let dataWithInfo = {//定义数据结构
    pixelSpacingW: null,
    pixelSpacingH: null,
    pixelSpacingD: null,
    leftTopPos: { wA: 0, hA: 0, dA: 0 }, //当前图像左上角的绝对坐标，用宽，高，深定义
    origBuf: {}//原始数据
  }
  let { w: pixelSpacingW, h: pixelSpacingH, d: pixelSpacingD } = seriesInfo.pixelSpacingObj[curViewMod]
  dataWithInfo = { ...dataWithInfo, pixelSpacingW, pixelSpacingH, pixelSpacingD }
  dataWithInfo.leftTopPos = this.getLeftTopPosAbs(curViewMod, curImageNum, seriesInfo)
  dataWithInfo.origBuf = this.getOrigBuf(poor, seriesInfo, curViewMod, { curImageNum })
  return dataWithInfo
},

getOrigBuf(poor, seriesInfo, curViewMod, { curImageNum, index1, index2, cindex }) {
  let origBuf
  let model = seriesInfo.model
  let size = seriesInfo.imageSizeObj[curViewMod]
  let width = size.w, height = size.h, depth = size.d
  let poorNow = poor[curViewMod]

  //如果是已经存在的数据，直接返回
  if (curImageNum && Number.isInteger(curImageNum) && poorNow[curImageNum]) {
    return poorNow[curImageNum]
  }

  //如果curImageNum存在且不是整数
  if (curImageNum && !Number.isInteger(curImageNum)) {
    cindex = curImageNum
    index1 = Math.floor(curImageNum)
    index2 = Math.ceil(curImageNum)
    curImageNum = undefined
  }

  let img_length = width * height
  let isForceFloat = true
  let buf = LOAD.createDataArray(img_length, model, isForceFloat)
  //超过范围是数据不需要处理
  if ((curImageNum && (curImageNum < 0 || curImageNum > depth - 1)) || (cindex && (cindex < 0 || cindex > depth - 1))) {
    origBuf = { width: width, height: height, data: buf }
    return origBuf
  }

  let index2_cindex = index2 - cindex
  let cindex_index1 = cindex - index1
  if (index1 !== undefined && index2 !== undefined && cindex !== undefined) {
    if (index1 == cindex || index2 == cindex) {
      curImageNum = cindex //这种情况不需要插值
      //如果是已经存在的数据，直接返回
      if (curImageNum && poorNow[curImageNum]) {
        buf = undefined //释放数组避免内存泄露
        return poorNow[curImageNum]
      }
    }
    if (poorNow[index1] && poorNow[index2])//这种情况不要判断视图，可以直接插值得到结果
    {
      for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
          let data1 = poorNow[index1].data[j * width + i]
          let data2 = poorNow[index2].data[j * width + i]
          buf[j * width + i] = (index2_cindex) * data1 + (cindex_index1) * data2
        }
      }
      origBuf = { width: width, height: height, data: buf }
      return origBuf
    }
  }

  //走到这里就必须重建非原始视图的图像了，要么curImageNum为undefined,要么index1 index2 cindex为undefined
  let poor0 = poor[seriesInfo.initViewMod]
  size = seriesInfo.imageSizeObj[seriesInfo.initViewMod]
  //重置了长宽高方便后续的计算
  width = size.w
  height = size.h
  depth = size.d
  //创建一个字典
  let disc = [[0, 1, 2], [1, 0, 2], [1, 2, 0]]
  let newViewMod = disc[seriesInfo.initViewMod][curViewMod]
  switch (newViewMod) {
    case 0: {
      if (curImageNum !== undefined) {
        buf = undefined //释放数组避免内存泄露
        return poor0[curImageNum]
      } else if (index1 !== undefined && index2 !== undefined && cindex !== undefined) {
        for (let i = 0; i < width; i++) {
          for (let j = 0; j < height; j++) {
            let data1 = poor0[index1].data[j * width + i]
            let data2 = poor0[index2].data[j * width + i]
            buf[j * width + i] = (index2_cindex) * data1 + (cindex_index1) * data2
          }
        }
      }
      origBuf = { width: width, height: height, data: buf }
      break
    }
    case 1: {
      if (seriesInfo.initViewMod == 2) {
        if (curImageNum !== undefined) {
          if (poorNow[curImageNum]) {
            buf = undefined //释放数组避免内存泄露
            return poorNow[curImageNum]
          }
          for (let i = 0; i < width; i++) {
            for (let j = 0; j < depth; j++) {
              buf[i * depth + j] = poor0[j].data[curImageNum * width + i]
            }
          }
        } else if (index1 !== undefined && index2 !== undefined && cindex !== undefined) {
          for (let i = 0; i < width; i++) {
            for (let j = 0; j < depth; j++) {
              let data1 = poor0[j].data[index1 * width + i]
              let data2 = poor0[j].data[index2 * width + i]
              buf[i * depth + j] = (index2_cindex) * data1 + (cindex_index1) * data2
            }
          }
        }
        origBuf = { width: depth, height: width, data: buf }
      }
      else {
        if (curImageNum !== undefined) {
          if (poorNow[curImageNum]) {
            buf = undefined //释放数组避免内存泄露
            return poorNow[curImageNum]
          }
          for (let i = 0; i < width; i++) {
            for (let j = 0; j < depth; j++) {
              buf[j * width + i] = poor0[j].data[curImageNum * width + i]
            }
          }
        } else if (index1 !== undefined && index2 !== undefined && cindex !== undefined) {
          for (let i = 0; i < width; i++) {
            for (let j = 0; j < depth; j++) {
              let data1 = poor0[j].data[index1 * width + i]
              let data2 = poor0[j].data[index2 * width + i]
              buf[j * width + i] = (index2_cindex) * data1 + (cindex_index1) * data2
            }
          }
        }
        origBuf = { width: width, height: depth, data: buf }
      }
      break
    }
    case 2: {
      if (seriesInfo.initViewMod == 0) {
        if (curImageNum !== undefined) {
          if (poorNow[curImageNum]) {
            buf = undefined //释放数组避免内存泄露
            return poorNow[curImageNum]
          }
          for (let i = 0; i < height; i++) {
            for (let j = 0; j < depth; j++) {
              buf[j * height + i] = poor0[j].data[i * width + curImageNum]
            }
          }
        } else if (index1 !== undefined && index2 !== undefined && cindex !== undefined) {
          for (let i = 0; i < height; i++) {
            for (let j = 0; j < depth; j++) {
              let data1 = poor0[j].data[i * width + index1]
              let data2 = poor0[j].data[i * width + index2]
              buf[j * height + i] = (index2_cindex) * data1 + (cindex_index1) * data2
            }
          }
        }
        origBuf = { width: height, height: depth, data: buf }
      } else {
        if (curImageNum !== undefined) {
          if (poorNow[curImageNum]) {
            buf = undefined //释放数组避免内存泄露
            return poorNow[curImageNum]
          }
          for (let i = 0; i < height; i++) {
            for (let j = 0; j < depth; j++) {
              buf[i * depth + j] = poor0[j].data[i * width + curImageNum]
            }
          }

        } else if (index1 !== undefined && index2 !== undefined && cindex !== undefined) {
          for (let i = 0; i < height; i++) {
            for (let j = 0; j < depth; j++) {
              let data1 = poor0[j].data[i * width + index1]
              let data2 = poor0[j].data[i * width + index2]
              buf[i * depth + j] = (index2_cindex) * data1 + (cindex_index1) * data2
            }
          }

        }
        origBuf = { width: depth, height: height, data: buf }
      }
      break
    }
  }
  return origBuf
},
}

export default LOAD;