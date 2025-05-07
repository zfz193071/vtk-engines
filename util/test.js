import CatcherEngine from "./catcherEngine.js";
import CIMG from './cimg.js';
import LOAD from './loadImg.js';
import DataWithInfo from './tDataWithInfo.js';
const { mat4 } = glMatrix

class RenderEngine {
  constructor(rootDom, para, GPARA) {
    // ... 原有代码 ...
    this.isOrthogonalRotation = false; // 添加开关变量
  }

  setOrthogonalRotation (enabled) {
    this.isOrthogonalRotation = enabled;
  }

  // ... 原有代码 ...

  setCrossFromCatcher (pos, flag) {
    if (flag === "start") {
      if (this.#circleChoosed) {
        this.#crossRotateStart = pos
        this.#crossMoveStart = false
        this.#crossThickStart = false
      } else if (this.#rectChoosed) {
        this.#crossThickStart = { axes: this.#rectChoosed.axes, imatrix: this.#rectChoosed.imatrix }
        this.#crossMoveStart = false
        this.#crossRotateStart = false
      }
      else {
        this.#crossMoveStart = pos
        this.#crossRotateStart = false
        this.#crossThickStart = false
      }
      //设置鼠标样式为不可见
      this.#catcherEngine.getCatrcherDom().style.cursor = "none"
    }
    if (flag === "end") {
      this.#crossMoveStart = false
      this.#crossThickStart = false
      this.#crossRotateStart = false
      this.drawCrossOn3d(pos)
      //设置鼠标样式为默认
      this.#catcherEngine.getCatrcherDom().style.cursor = "default"
    }
    if (flag === "move") {
      if (this.#crossMoveStart) {
        // ... 原有代码 ...
      }
      if (this.#crossRotateStart) {
        let center = { x: this.#crossOn3DScreen.x, y: this.#crossOn3DScreen.y }
        let start = this.#crossRotateStart
        let end = pos
        let vecA = [start.x - center.x, start.y - center.y]
        let vecB = [end.x - center.x, end.y - center.y]
        let radian = this.getAngle(vecA, vecB)  //弧度
        let angle = Math.round(radian * (180 / Math.PI))//转成角度
        if (angle != 0) {
          let temp = this.#GPARA
          if (this.isOrthogonalRotation) {
            // 正交状态，两条线一起旋转
            if (this.#curViewMod === 0) {
              temp.rotateT = Number(temp.rotateT) + angle
            }
            if (this.#curViewMod === 1) {
              temp.rotateC = Number(temp.rotateC) + angle
            }
            if (this.#curViewMod === 2) {
              temp.rotateS = Number(temp.rotateS) + angle
            }
          } else {
            // 非正交状态，判断旋转的是哪条线
            let isRotatingXAxis = Math.abs(end.x - center.x) > Math.abs(end.y - center.y);
            if (this.#curViewMod === 0) {
              if (isRotatingXAxis) {
                temp.rotateT = Number(temp.rotateT) + angle
              } else {
                // 旋转 Y 轴时，保持 X 轴旋转角度不变
              }
            }
            if (this.#curViewMod === 1) {
              if (isRotatingXAxis) {
                temp.rotateC = Number(temp.rotateC) + angle
              } else {
                // 旋转 Y 轴时，保持 X 轴旋转角度不变
              }
            }
            if (this.#curViewMod === 2) {
              if (isRotatingXAxis) {
                temp.rotateS = Number(temp.rotateS) + angle
              } else {
                // 旋转 Y 轴时，保持 X 轴旋转角度不变
              }
            }
          }
          this.#crossRotateStart = { ...end }
          this.#GPARA.value = { ...temp }
        }
      }
      if (this.#crossThickStart) {
        // ... 原有代码 ...
      }
    }
  }

  drawCross (ctx) {
    if (!this.#crossPos) {
      return;
    }
    let { translate, rotate, scale } = this.#transformPara
    let { x, y, r = 0 } = this.#crossPos;
    let width = this.#imgCanvas.width;
    let height = this.#imgCanvas.height;
    let point = LOAD.$coordinateImageToCanvas(
      translate,
      rotate,
      scale,
      width,
      height,
      this.#renderCanvas.width,
      this.#renderCanvas.height,
      { x, y }
    );
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(r);

    let l = 3000;
    ctx.lineWidth = 1;
    ctx.lineWidth = 1;
    let { colorX, colorY, dottedLine1, dottedLine2 } = this.#positionLine["curViewMod" + this.#curViewMod]

    ctx.strokeStyle = colorX;
    ctx.setLineDash(dottedLine1);
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(-l, 0);
    ctx.stroke();

    ctx.moveTo(5, 0);
    ctx.lineTo(l, 0);
    ctx.stroke();

    ctx.strokeStyle = colorY;
    ctx.setLineDash(dottedLine2);
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(0, -l);
    ctx.stroke();

    ctx.moveTo(0, 5);
    ctx.lineTo(0, l);
    ctx.stroke();
    ctx.restore();
  }

  drawCrossOn3d (screenPos = {}) {
    let ctx = this.#renderCanvas3D.getContext("2d")
    ctx.clearRect(0, 0, this.#renderCanvas3D.width, this.#renderCanvas3D.height)
    ctx.save();
    //此处变换到了十字中心点所在的位置
    ctx.translate(this.#crossOn3DScreen.x, this.#crossOn3DScreen.y);
    ctx.rotate(this.#crossOn3DScreen.r);

    let Dis = 60, rForCircle = 5, rForRect = 4, findRange = 10
    let circleDis = 2 * Dis, rectDis = Dis

    let thicknessX, thicknessY
    let { thickT, thickC, thickS } = this.#GPARA
    thickT = Number(thickT); thickC = Number(thickC); thickS = Number(thickS)

    switch (this.#curViewMod) {
      case 0: {
        thicknessX = thickC
        thicknessY = thickS
        break
      }
      case 1: {
        thicknessX = thickT
        thicknessY = thickS
        break
      }
      case 2: {
        thicknessX = thickT
        thicknessY = thickC
        break
      }
    }
    //转换成屏幕上的层厚
    thicknessX = (thicknessX / this.#initPixelSpacing) * Number(this.#GPARA.scale)
    thicknessY = (thicknessY / this.#initPixelSpacing) * Number(this.#GPARA.scale)

    thicknessX = thicknessX / 2
    thicknessY = thicknessY / 2

    let flag = { circleShow: false, rectShow: false, rectShowX: false, rectShowY: false }
    let canvasPos = {}
    const transform = ctx.getTransform()
    const imatrix = transform.invertSelf()
    if (screenPos.x && screenPos.y) {
      canvasPos = this.screenToCanvas(screenPos, imatrix)
      let { x, y } = canvasPos
      if (x && y) {
        if (Math.abs(x) < findRange || Math.abs(y) < findRange) {
          flag.circleShow = true
          flag.rectShow = true
        }
        if (thicknessX > 1 && (Math.abs(y - thicknessX) < findRange || Math.abs(y + thicknessX) < findRange)) {
          flag.circleShow = true
          flag.rectShow = true
        }
        if (thicknessY > 1 && (Math.abs(x - thicknessY) < findRange || Math.abs(x + thicknessY) < findRange)) {
          flag.circleShow = true
          flag.rectShow = true
        }
      }
    }

    if (this.#crossRotateStart) {
      flag.circleShow = true
      flag.rectShow = false
    }
    if (this.#crossThickStart) {
      flag.rectShow = true
      flag.circleShow = false
    }

    let l = 3000, CD = 5

    ctx.lineWidth = 2;
    let { colorX, colorY, dottedLine1, dottedLine2, thickLine } = this.#positionLine["curViewMod" + this.#curViewMod]

    let line = [
      {
        strokeStyle: colorX,
        c: { x1: -l, y1: 0, x2: -CD, y2: 0 },
        dottSytle: dottedLine1
      },
      {
        strokeStyle: colorX,
        c: { x1: CD, y1: 0, x2: l, y2: 0 },
        dottSytle: dottedLine1
      },
      {
        strokeStyle: colorY,
        c: { x1: 0, y1: -l, x2: 0, y2: -CD },
        dottSytle: dottedLine2
      },
      {
        strokeStyle: colorY,
        c: { x1: 0, y1: CD, x2: 0, y2: l },
        dottSytle: dottedLine2
      }
    ]
    if (thicknessX > 1) {
      for (let i = 0; i < 2; i++) {
        let ele1 = JSON.parse(JSON.stringify(line[i]))
        ele1.dottSytle = thickLine
        ele1.c.y1 = -thicknessX
        ele1.c.y2 = -thicknessX
        line.push(ele1)
        let ele2 = JSON.parse(JSON.stringify(ele1))
        ele2.c.y1 = thicknessX
        ele2.c.y2 = thicknessX
        line.push(ele2)
      }
    }
    if (thicknessY > 1) {
      for (let i = 2; i < 4; i++) {
        let ele1 = JSON.parse(JSON.stringify(line[i]))
        ele1.dottSytle = thickLine
        ele1.c.x1 = -thicknessY
        ele1.c.x2 = -thicknessY
        line.push(ele1)
        let ele2 = JSON.parse(JSON.stringify(ele1))
        ele2.c.x1 = thicknessY
        ele2.c.x2 = thicknessY
        line.push(ele2)
      }
    }
    for (let i = 0; i < line.length; i++) {
      this.drawLine(ctx, line[i].c, line[i].dottSytle, line[i].strokeStyle)
    }

    let circle = []
    if (flag.circleShow) {
      circle[0] = { c: { x: -circleDis, y: 0, r: rForCircle }, ifFill: false, strokeStyle: colorX, fillStyle: colorX }
      circle[1] = { c: { x: circleDis, y: 0, r: rForCircle }, ifFill: false, strokeStyle: colorX, fillStyle: colorX }
      circle[2] = { c: { x: 0, y: -circleDis, r: rForCircle }, ifFill: false, strokeStyle: colorY, fillStyle: colorY }
      circle[3] = { c: { x: 0, y: circleDis, r: rForCircle }, ifFill: false, strokeStyle: colorY, fillStyle: colorY }
    }
    this.#circleChoosed = null
    for (let i = 0; i < circle.length; i++) {
      let { x, y } = canvasPos
      if (x && y && Math.pow(circle[i].c.x - x, 2) + Math.pow(circle[i].c.y - y, 2) <= Math.pow(findRange, 2)) {
        circle[i].ifFill = true
        this.#circleChoosed = this.canvseToScreen(circle[i].c, imatrix)
      }
      if (this.#crossRotateStart) {
        circle[i].ifFill = true
      }
      this.drawCircle(ctx, circle[i].c, circle[i].ifFill, circle[i].strokeStyle, circle[i].fillStyle)
    }


    let rect = []
    this.#rectChoosed = null
    let indexFromXtoY
    if (flag.rectShow) {
      if (thicknessX > 1) {
        rect[0] = { c: { x: -rectDis, y: -thicknessX, r: rForRect }, ifFill: false, strokeStyle: colorX, fillStyle: colorX }
        rect[1] = { c: { x: rectDis, y: -thicknessX, r: rForRect }, ifFill: false, strokeStyle: colorX, fillStyle: colorX }
        rect[2] = { c: { x: -rectDis, y: thicknessX, r: rForRect }, ifFill: false, strokeStyle: colorX, fillStyle: colorX }
        rect[3] = { c: { x: rectDis, y: thicknessX, r: rForRect }, ifFill: false, strokeStyle: colorX, fillStyle: colorX }
      } else {
        rect[0] = { c: { x: -rectDis, y: 0, r: rForRect }, ifFill: false, strokeStyle: colorX, fillStyle: colorX }
        rect[1] = { c: { x: rectDis, y: 0, r: rForRect }, ifFill: false, strokeStyle: colorX, fillStyle: colorX }
      }
      indexFromXtoY = rect.length

      if (thicknessY > 1) {
        rect[indexFromXtoY] = { c: { x: -thicknessY, y: -rectDis, r: rForRect }, ifFill: false, strokeStyle: colorY, fillStyle: colorY }
        rect[indexFromXtoY + 1] = { c: { x: -thicknessY, y: rectDis, r: rForRect }, ifFill: false, strokeStyle: colorY, fillStyle: colorY }
        rect[indexFromXtoY + 2] = { c: { x: thicknessY, y: -rectDis, r: rForRect }, ifFill: false, strokeStyle: colorY, fillStyle: colorY }
        rect[indexFromXtoY + 3] = { c: { x: thicknessY, y: rectDis, r: rForRect }, ifFill: false, strokeStyle: colorY, fillStyle: colorY }
      } else {
        rect[indexFromXtoY] = { c: { x: 0, y: -rectDis, r: rForRect }, ifFill: false, strokeStyle: colorY, fillStyle: colorY }
        rect[indexFromXtoY + 1] = { c: { x: 0, y: rectDis, r: rForRect }, ifFill: false, strokeStyle: colorY, fillStyle: colorY }
      }
    }
    for (let i = 0; i < rect.length; i++) {
      let { x, y } = canvasPos
      if (x && y && Math.abs(rect[i].c.x - x) <= findRange && Math.abs(rect[i].c.y - y) <= findRange) {
        rect[i].ifFill = true
        this.#rectChoosed = this.canvseToScreen(rect[i].c, imatrix)
        this.#rectChoosed.type = rect[i].type
        if (i < indexFromXtoY) {
          this.#rectChoosed.axes = "x"
        } else {
          this.#rectChoosed.axes = "y"
        }
        this.#rectChoosed.imatrix = imatrix
      }
      if (this.#crossThickStart) {
        rect[i].ifFill = true
      }
      this.drawRect(ctx, rect[i].c, rect[i].ifFill, rect[i].strokeStyle, rect[i].fillStyle)
    }

    //先画X轴

    ctx.restore();
  }

  // ... 原有代码 ...
}

export default RenderEngine;