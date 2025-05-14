setCross(crossPosOnImage, thicknessArr, rotateAngelGlobal) {
  let patientVolume = this.#vtkSource.patientVolume
  let volumeOrigin = patientVolume.getOrigin()
  let volumeSpacing = patientVolume.getSpacing()
  let clipPlaneNormal1, clipPlaneNormal2, clipPlaneOrigin1 = [], clipPlaneOrigin2 = []
  const axes = this.getAxes(volumeOrigin, volumeSpacing, crossPosOnImage, rotateAngelGlobal)
  let newX = [axes[0], axes[1], axes[2]]
  let newY = [axes[4], axes[5], axes[6]]
  let newZ = [axes[8], axes[9], axes[10]]
  let newCenter = [axes[12], axes[13], axes[14]]
  this.#newaxes = { newX, newY, newZ, newCenter }
  this.#thickness = thicknessArr[this.#curViewMod]
  clipPlaneNormal1 = [newZ[0], newZ[1], newZ[2]]
  clipPlaneNormal2 = [-newZ[0], -newZ[1], -newZ[2]]
  for (let i = 0; i < 3; i++) {
    clipPlaneOrigin1[i] = newCenter[i] - this.#thickness / 2 * newZ[i]
    clipPlaneOrigin2[i] = newCenter[i] + this.#thickness / 2 * newZ[i]
  }
  this.#clipPlane1.setNormal(clipPlaneNormal1);
  this.#clipPlane1.setOrigin(clipPlaneOrigin1);
  this.#clipPlane2.setNormal(clipPlaneNormal2);
  this.#clipPlane2.setOrigin(clipPlaneOrigin2);
}

setCrossFromCatcher(pos, flag) {
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
      // 屏幕坐标转归一化坐标（0~1），并Y轴翻转
      let screenPosNormalized = { x: pos.x / this.#renderCanvas.width, y: 1 - pos.y / this.#renderCanvas.height, z: this.#crossOn3DScreen.z }
      // 转换为世界坐标
      let worldPos = this.#vtkRenderer.normalizedDisplayToWorld(screenPosNormalized.x, screenPosNormalized.y, screenPosNormalized.z, 1)
      // 计算在图像体素中的位置（整数索引）
      let origin = this.#vtkSource.patientVolume.getOrigin()
      let pixcelSpacing = this.#vtkSource.patientVolume.getSpacing()
      let newCrossOnImage = [Math.round((worldPos[0] - origin[0]) / pixcelSpacing[0]), Math.round((worldPos[1] - origin[1]) / pixcelSpacing[1]), Math.round((worldPos[2] - origin[2]) / pixcelSpacing[2])]
      //赋值
      let temp = this.#GPARA
      temp.pageS = newCrossOnImage[0]
      temp.pageC = newCrossOnImage[1]
      temp.pageT = newCrossOnImage[2]
      this.#GPARA.value = { ...temp }
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
        if (this.#curViewMod === 0) {
          temp.rotateT = Number(temp.rotateT) + angle
        }
        if (this.#curViewMod === 1) {
          temp.rotateC = Number(temp.rotateC) + angle
        }
        if (this.#curViewMod === 2) {
          temp.rotateS = Number(temp.rotateS) + angle
        }
        this.#crossRotateStart = { ...end }
        this.#GPARA.value = { ...temp }
      }
    }
  }
}
drawCrossOn3d(screenPos = {}) {
  let ctx = this.#renderCanvas3D.getContext("2d")
  ctx.clearRect(0, 0, this.#renderCanvas3D.width, this.#renderCanvas3D.height)

  ctx.save();

  ctx.translate(this.#crossOn3DScreen.x, this.#crossOn3DScreen.y);

  ctx.rotate(this.#crossOn3DScreen.r);


  let Dis = 60, rForCircle = 5, rForRect = 4, findRange = 10


  let thicknessX, thicknessY

  let { thickT, thickC, thickS } = this.#GPARA
  thickT = Number(thickT); thickC = Number(thickC); thickS = Number(thickS)


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

  let l = 3000
  let CD = 5

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
  for (let i = 0; i < line.length; i++) {
    this.drawLine(ctx, line[i].c, line[i].dottSytle, line[i].strokeStyle)
  }
  ctx.restore();
}
