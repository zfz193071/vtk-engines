import CatcherEngine from "./catcherEngine.js";
import CIMG from './cimg.js';
import LOAD from './loadImg.js';
import DataWithInfo from './tDataWithInfo.js';
const { mat4 } = glMatrix
class RenderEngine {
    constructor(rootDom, para, GPARA) {

        if (!rootDom) return
        let canvasDom = rootDom.querySelector("canvas")
        let divDom = rootDom.querySelector("div")
        this.#vtkRootDom = divDom
        this.#GPARA = GPARA

        if (!canvasDom) this.#renderCanvas = document.createElement("canvas")
        else this.#renderCanvas = canvasDom

        this.#imgCanvas = document.createElement("canvas")
        this.#hideCanvas1 = document.createElement("canvas")
        this.#hideCanvas2 = document.createElement("canvas")

        this.#renderContext = this.getContext()
        this.setProps(para)
        const fullScreenRenderer = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
            rootContainer: this.#vtkRootDom,
            containerStyle: {
                height: '100%',
                width: '100%'
            },
            background: [0, 0, 0]
        })
        let interactor = fullScreenRenderer.getInteractor();
        const interactorStyle = vtk.Interaction.Style.vtkInteractorStyleManipulator.newInstance();
        interactorStyle.removeAllMouseManipulators();
        // interactor.unbindEvents();
        interactor.setInteractorStyle(interactorStyle);
        this.#vtkRenderWindow = fullScreenRenderer.getRenderWindow()
        this.#vtkRenderer = fullScreenRenderer.getRenderer()
        this.#renderCanvas3D = document.createElement("canvas")
        this.#renderCanvas3D.style.position = "absolute"
        this.#renderCanvas3D.style.top = "0px"
        this.#renderCanvas3D.style.left = "0px"
        this.#renderCanvas3D.width = this.#renderCanvas.width
        this.#renderCanvas3D.height = this.#renderCanvas.height
        this.#vtkRootDom.appendChild(this.#renderCanvas3D)


        //初始化#catcherEngine
        this.#catcherEngine = new CatcherEngine(this.#renderCanvas3D)
        this.#catcherEngine.setGPARA(GPARA)
        //初始化catcher的操作
        this.#catcherEngine.setRender(this)
    }
    #catcherEngine = null
    #renderCanvas = null
    #renderCanvas3D = null
    #renderContext = null
    #vtkRootDom = null
    #vtkRenderWindow = null
    #vtkRenderer = null
    #vtkSource = null
    #clipPlane1 = null
    #clipPlane2 = null
    #dataWithInfo_base = new DataWithInfo({})
    #dataWithInfo_fusion = new DataWithInfo({})
    #initPixelSpacing = 1
    #curViewMod = 0
    #fusionOpacity = 0.5

    #imgCanvas = null
    #hideCanvas1 = null
    #hideCanvas2 = null
    #GPARA = null

    #props = {
        backgroupCanvas: "#000",
        borderColor: "#fff",
        rangeSize: [300, 300]
    }
    #colorPara_base = {
        colormapIndex: 'B&W',
        ww: 1000,
        wl: 500,
    }
    #colorPara_fusion = {
        colormapIndex: 'PET',
        ww: 10000,
        wl: 5000,
    }
    #transformPara = {
        scale: { x: 0.5, y: 0.5 },
        translate: { x: 0, y: 0 },
        rotate: 0
    }
    #thickness = 1
    #crossPos = {
        x: 10,
        y: 10,
        r: 0
    }
    #crossOn3DScreen = {
        x: 10,
        y: 10,
        r: 0
    }
    #newaxes = { newX: [1, 0, 0], newY: [0, 1, 0], newZ: [0, 0, 1] }
    #colorS = "#3470d8"
    #colorC = "#cd9700"
    #colorT = "#8a00da"
    #positionLine = {
        // 十字定位线
        default: {
            colorX: "#25a5ad",
            colorY: "#25a5ad",
            dottedLine1: [], // 空数组代表实线, [1, 1]: 虚线长度1，实线长度1，虚线长度1，实线...
            dottedLine2: [],
            thickLine: [7, 5]
        },
        curViewMod0: {
            colorX: this.#colorC,
            colorY: this.#colorS,
            dottedLine1: [],
            dottedLine2: [],
            thickLine: [7, 5]
        },
        curViewMod1: {
            colorX: this.#colorT,
            colorY: this.#colorS,
            dottedLine1: [],
            dottedLine2: [],
            thickLine: [7, 5]
        },
        curViewMod2: {
            colorX: this.#colorT,
            colorY: this.#colorC,
            dottedLine1: [],
            dottedLine2: [],
            thickLine: [7, 5]
        },
    }
    #circleChoosed = null
    #rectChoosed = null


    setProps (para) {
        this.#props = { ...this.#props, ...para }
        let props = this.#props
        this.#renderCanvas.width = props.rangeSize[0]
        this.#renderCanvas.height = props.rangeSize[1] / 2
        this.#vtkRootDom.style.width = props.rangeSize[0] + "px"
        this.#vtkRootDom.style.height = props.rangeSize[1] / 2 + "px"
        this.#vtkRootDom.style.top = props.rangeSize[1] / 2 + "px"
    }
    setCurrenViewMod (curViewMod) {
        this.#curViewMod = curViewMod
        this.#catcherEngine.setCurViewMod(curViewMod)
    }
    setScale2D (scale) {
        let { pixelSpacingW, pixelSpacingH } = this.#dataWithInfo_base
        this.#transformPara.scale = { x: this.getRenderScale(pixelSpacingW, scale), y: this.getRenderScale(pixelSpacingH, scale) }
    }
    setScale3D (scale, rotateAngelGlobal) {
        this.setCamera(scale, rotateAngelGlobal)
    }
    setCamera (scale, rotateAngelGlobal) {
        let camera = vtk.Rendering.Core.vtkCamera.newInstance();

        camera.setFocalPoint(0, 0, 0);   //当前的十字位置点
        let { newX, newY, newZ, newCenter } = this.#newaxes
        camera.setPosition(-newZ[0], -newZ[1], -newZ[2]);  //相机的位置
        camera.setViewUp(-newY[0], -newY[1], -newY[2])   //视角的方向
        this.#vtkRenderer.setActiveCamera(camera)
        this.#vtkRenderer.resetCamera()
        let distance = camera.getDistance();
        let angle = Math.atan(this.#renderCanvas.height / (2 * (scale / this.#initPixelSpacing) * distance)) * 360 / Math.PI
        camera.setViewAngle(angle)
        let displayCoords = this.#vtkRenderer.worldToNormalizedDisplay(newCenter[0], newCenter[1], newCenter[2], 1)
        this.#crossOn3DScreen = { x: displayCoords[0] * this.#renderCanvas.width, y: (1 - displayCoords[1]) * this.#renderCanvas.height, z: displayCoords[2], r: rotateAngelGlobal[this.#curViewMod] }
    }
    setWWWL (ww, wl) {
        this.#colorPara_base.ww = ww
        this.#colorPara_base.wl = wl
        if (this.#vtkSource) this.#vtkSource.setWWWL(ww, wl, "B&W")
    }
    setMapperActor (source) {
        const vtkPlane = vtk.Common.DataModel.vtkPlane
        this.#clipPlane1 = vtkPlane.newInstance();
        this.#clipPlane2 = vtkPlane.newInstance();
        source.Mapper.addClippingPlane(this.#clipPlane1);
        source.Mapper.addClippingPlane(this.#clipPlane2);
        this.#vtkSource = source
        this.#initPixelSpacing = this.#vtkSource.patientVolume.getSpacing()[0]
        this.#vtkRenderer.addActor(source.Actor)
        //增加平面
    }
    setPage_old (page, thicknessArr, rotateAngelGlobal) {
        let patientVolume = this.#vtkSource.patientVolume
        let volumeOrigin = patientVolume.getOrigin()
        let volumeSpacing = patientVolume.getSpacing()
        let volumeSize = patientVolume.getDimensions()
        let crossPosOnImage = [page[2], page[1], volumeSize[2] - page[0]]
        let clipPlaneNormal1, clipPlaneNormal2, clipPlaneOrigin1 = [], clipPlaneOrigin2 = [], clipPosition1, clipPosition2, thickness
        switch (this.#curViewMod) {
            case 0: {
                let page = crossPosOnImage[2]
                thickness = thicknessArr[2]
                clipPosition1 = volumeOrigin[2] + page * volumeSpacing[2] - thickness / 2
                clipPosition2 = -(volumeOrigin[2] + page * volumeSpacing[2] + thickness / 2)
                clipPlaneNormal1 = [0, 0, 1];
                clipPlaneNormal2 = [0, 0, -1];
                break;
            }
            case 1: {
                let page = crossPosOnImage[1]
                thickness = thicknessArr[1]
                clipPosition1 = volumeOrigin[1] + page * volumeSpacing[1] - thickness / 2
                clipPosition2 = -(volumeOrigin[1] + page * volumeSpacing[1] + thickness / 2)
                clipPlaneNormal1 = [0, 1, 0];
                clipPlaneNormal2 = [0, -1, 0];
                break;
            }
            case 2: {
                let page = crossPosOnImage[0]
                thickness = thicknessArr[0]
                clipPosition1 = volumeOrigin[0] + page * volumeSpacing[0] - thickness / 2
                clipPosition2 = -(volumeOrigin[0] + page * volumeSpacing[0] + thickness / 2)
                clipPlaneNormal1 = [1, 0, 0];
                clipPlaneNormal2 = [-1, 0, -0];
                break;
            }
        }

        clipPlaneOrigin1 = [clipPlaneNormal1[0] * clipPosition1, clipPlaneNormal1[1] * clipPosition1, clipPlaneNormal1[2] * clipPosition1];
        clipPlaneOrigin2 = [clipPlaneNormal2[0] * clipPosition2, clipPlaneNormal2[1] * clipPosition2, clipPlaneNormal2[2] * clipPosition2];
        this.#clipPlane1.setNormal(clipPlaneNormal1);
        this.#clipPlane1.setOrigin(clipPlaneOrigin1);
        this.#clipPlane2.setNormal(clipPlaneNormal2);
        this.#clipPlane2.setOrigin(clipPlaneOrigin2);
    }
    // 设置用于截取图像切面的两个剪切平面（clip planes），从而实现十字线所在的两个正交平面的几何位置和方向调整
    setCross (crossPosOnImage, thicknessArr, rotateAngelGlobal) {
        let patientVolume = this.#vtkSource.patientVolume
        let volumeOrigin = patientVolume.getOrigin()
        let volumeSpacing = patientVolume.getSpacing()
        let clipPlaneNormal1, clipPlaneNormal2, clipPlaneOrigin1 = [], clipPlaneOrigin2 = []
        const axes = this.getAxes(volumeOrigin, volumeSpacing, crossPosOnImage, rotateAngelGlobal)
        let newX = [axes[0], axes[1], axes[2]]
        let newY = [axes[4], axes[5], axes[6]]
        let newZ = [axes[8], axes[9], axes[10]]
        //截取平面时坐标原点的世界坐标
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
    #crossMoveStart = false
    #crossThickStart = false
    #crossRotateStart = false
    #isHorizontalDrag = false; // 新增，用于标记是否是水平拖动
    #dragHistory = []; // 新增：用于记录拖动历史
    #crossCenter = { x: 0, y: 0, z: 0 };  // 十字中心点
    #crossAngle = 0; // 主线角度（单位：角度或弧度）
    setCrossFromCatcher (pos, flag, isOrthogonalMode) {
        if (flag === "start") {
            const center = this.#crossOn3DScreen;
            const dx = pos.x - center.x;
            const dy = pos.y - center.y;
            const dist = Math.hypot(dx, dy);

            // 启动时距离中心够远，才判断是拖动角度
            if (dist > 5) {
                this.#crossRotateStart = pos;
                this.#crossMoveStart = null;
            } else {
                this.#crossMoveStart = pos;
                this.#crossRotateStart = null;
            }

            this.#catcherEngine.getCatrcherDom().style.cursor = "none";
        }

        if (flag === "move") {
            const center = this.#crossOn3DScreen;

            if (this.#crossRotateStart) {
                // 鼠标绕中心旋转，改变角度
                const prev = this.#crossRotateStart;
                const curr = pos;

                const anglePrev = Math.atan2(prev.y - center.y, prev.x - center.x);
                const angleCurr = Math.atan2(curr.y - center.y, curr.x - center.x);
                let deltaAngle = angleCurr - anglePrev;

                // 角度归一化到 [-PI, PI]
                if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
                if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

                // 更新主线角度
                this.#crossOn3DScreen.r += deltaAngle;

                if (isOrthogonalMode) {
                    // 正交模式：副线角度自动90度偏移
                    this.#crossOn3DScreen.rY = this.#crossOn3DScreen.r + Math.PI / 2;  // 副线角度保持 90 度
                }

                this.#crossRotateStart = curr;

                // 更新角度后重绘十字线
                this.drawCrossOn3d(center, isOrthogonalMode);
            }

            if (this.#crossMoveStart) {
                // 拖动中心点
                this.#crossOn3DScreen.x = pos.x;
                this.#crossOn3DScreen.y = pos.y;
                this.drawCrossOn3d(this.#crossOn3DScreen, isOrthogonalMode);
            }
        }

        if (flag === "end") {
            this.#crossRotateStart = null;
            this.#crossMoveStart = null;
            this.#catcherEngine.getCatrcherDom().style.cursor = "default";

            // 最后一次绘制
            this.drawCrossOn3d(this.#crossOn3DScreen, isOrthogonalMode);
        }
    }

    getAngle (vecA, vecB) {
        let angle = Math.atan2(vecB[1], vecB[0]) - Math.atan2(vecA[1], vecA[0])
        return angle
    }
    getNewVec (vec, angle) {
        let newVec = [vec[0] * Math.cos(angle) - vec[1] * Math.sin(angle), vec[0] * Math.sin(angle) + vec[1] * Math.cos(angle)]
        return newVec
    }

    setImageReslice (crossPosOnImage, thicknessArr, rotateArr) {
        let patientVolume = this.#vtkSource.patientVolume
        let volumeOrigin = patientVolume.getOrigin()
        let volumeSpacing = patientVolume.getSpacing()
        const vtkImageReslice = vtk.Imaging.Core.vtkImageReslice
        const imageReslice = vtkImageReslice.newInstance();
        this.#thickness = thicknessArr[this.#curViewMod]
        imageReslice.setInputData(patientVolume);


        imageReslice.setOutputDimensionality(2);
        imageReslice.setSlabMode(1)  //最大密度投影，最小密度投影，平均密度投影，求和

        imageReslice.setOutputScalarType('Uint16Array'); // 设置输出数据类型
        imageReslice.setInterpolationMode("Nearest")  //设置插值模式,Linear或者Nearest
        imageReslice.setTransformInputSampling(true)  //是否使用输入数据默认的spacing, origin and extent作为输出，默认值为true
        //mat formate，以当前图像的坐标轴为基准，进行旋转，所有矩阵的操作，都是以图像坐标系为基准的
        // 1 0 0 0  
        // 0 1 0 0  
        // 0 0 1 0  
        // 0 0 0 1 
        let axes = this.getAxes(volumeOrigin, volumeSpacing, crossPosOnImage, rotateArr)
        imageReslice.setSlabNumberOfSlices(this.#thickness);
        imageReslice.setResliceAxes(axes)
        let obliqueSlice = imageReslice.getOutputData();
        let dataArray = obliqueSlice.getPointData().getScalars().getData();
        let curDWI = this.getDataWithInfo(obliqueSlice, dataArray)
        this.loadBaseData(curDWI)
        this.#crossPos = this.getCrossPos(rotateArr, curDWI)
        switch (this.#curViewMod) { }
    }

    loadMixData (dataWithInfo_base, dataWithInfo_fusion) {
        this.#dataWithInfo_base = dataWithInfo_base
        this.#dataWithInfo_fusion = dataWithInfo_fusion
        this.updateImgFromMix()
    }

    loadBaseData (dataWithInfo) {
        this.#dataWithInfo_base = dataWithInfo
        this.#curViewMod = dataWithInfo.curViewMod
        this.updateFromBase()
    }

    //
    updateFromBase () {
        if (!this.#dataWithInfo_base) return
        if (!this.#dataWithInfo_base.origBuf) return
        if (this.#dataWithInfo_base.origBuf.isColor) {
            //是彩图
            renderData = origBuf;
            this.imageData.img.width = renderData.width;
            this.imageData.img.height = renderData.height;
            let ctx = this.imageData.img.getContext("2d");
            ctx.putImageData(renderData, 0, 0);
        }
        let { colormapIndex, ww, wl } = this.#colorPara_base
        let tarScale = { x: 1, y: 1 }
        this.#imgCanvas = CIMG.getRenderCImg(this.#dataWithInfo_base.origBuf, colormapIndex, ww, wl, tarScale, this.#imgCanvas)
    }

    //

    updateMixImg () {
        if (!this.#dataWithInfo_base) return
        if (!this.#dataWithInfo_base.origBuf) return
        if (!this.#dataWithInfo_fusion) return
        if (!this.#dataWithInfo_fusion.origBuf) return

        //计算PT到CT的scale和trans的参数
        let { scalePTtoCT, transPTtoCT } = LOAD.getFusionPara(
            this.#dataWithInfo_base,
            this.#dataWithInfo_fusion,
            this.#curViewMod
        );

        //暂时不考虑缩放过的情况
        let tarScale = { x: 1, y: 1 }
        //获取renderData
        let { colormapIndex: colormapIndex1, ww: ww1, wl: wl1 } = this.#colorPara_base
        let ct_renderData = CIMG.getRenderData(
            this.#dataWithInfo_base,
            colormapIndex1,
            ww1,
            wl1,
            tarScale
        );
        let { colormapIndex: colormapIndex2, ww: ww2, wl: wl2 } = this.#colorPara_fusion
        let pt_renderData = CIMG.getRenderData(
            this.imageData.dataWithInfo.origBuf,
            colormapIndex2,
            ww2,
            wl2,
            tarScale
        );
        this.#imgCanvas = CIMG.getMixRenderCImg(
            ct_renderData,
            pt_renderData,
            scalePTtoCT,
            transPTtoCT,
            this.#fusionOpacity,
            this.#imgCanvas,
            this.#hideCanvas1,
            this.#hideCanvas2
        );
    }
    refreshImg () {
        let { scale, rotate, translate } = this.#transformPara
        //清除画布
        this.#renderContext.clearRect(0, 0, this.#renderCanvas.width, this.#renderCanvas.height)
        let color = "#000";
        this.#renderContext.fillStyle = color;
        this.#renderContext.fillRect(0, 0, this.#renderCanvas.width, this.#renderCanvas.height)
        this.ctxDrawImage(this.#renderContext, this.#imgCanvas, scale, rotate, translate, this.#renderCanvas.width, this.#renderCanvas.height)
        this.drawCross(this.#renderContext)
    }

    ctxDrawImage (
        canvasEle_ctx,
        image,
        scale,
        rotate,
        translate,
        canvasWidth,
        canvasHeight
    ) {
        if (!image) return
        let scaleCur = { ...scale },
            imageCur = image;
        //允许图像在调窗之后做一个缩放
        let { ifInterPro, interCImg } = image;
        //允许图像在调窗之后做一个缩放
        if (ifInterPro && interCImg) {
            let scale_self = {
                x: interCImg.width / image.width,
                y: interCImg.height / image.height,
            };
            scaleCur.x = scale.x / scale_self.x;
            scaleCur.y = scale.y / scale_self.y;
            imageCur = interCImg;
        }
        //旋转平移缩放
        canvasEle_ctx.save();
        canvasEle_ctx.scale(scaleCur.x, scaleCur.y);
        // 平移到中心点
        let tempX =
            (canvasWidth / 2 + translate.x) / scaleCur.x - imageCur.width / 2;
        let tempY =
            (canvasHeight / 2 + translate.y) / scaleCur.y - imageCur.height / 2;
        canvasEle_ctx.translate(tempX, tempY);
        // 最后做旋转
        canvasEle_ctx.translate(imageCur.width / 2, imageCur.height / 2);
        canvasEle_ctx.scale(1 / scaleCur.x, 1 / scaleCur.y);
        canvasEle_ctx.rotate(rotate);
        canvasEle_ctx.scale(scaleCur.x, scaleCur.y);
        canvasEle_ctx.translate(-imageCur.width / 2, -imageCur.height / 2);

        canvasEle_ctx.drawImage(imageCur, 0, 0);
        canvasEle_ctx.restore();
    }

    //十字定位
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
    drawCrossOn3d (screenPos = {}, isOrthogonalMode) {
        let ctx = this.#renderCanvas3D.getContext("2d");
        ctx.clearRect(0, 0, this.#renderCanvas3D.width, this.#renderCanvas3D.height);
        ctx.save();
        //此处变换到了十字中心点所在的位置
        ctx.translate(this.#crossOn3DScreen.x, this.#crossOn3DScreen.y);
        ctx.rotate(this.#crossOn3DScreen.r);

        let Dis = 60, rForCircle = 5, rForRect = 4, findRange = 10;
        let circleDis = 2 * Dis, rectDis = Dis;

        let thicknessX, thicknessY;
        let { thickT, thickC, thickS } = this.#GPARA;
        thickT = Number(thickT); thickC = Number(thickC); thickS = Number(thickS);

        switch (this.#curViewMod) {
            case 0: {
                thicknessX = thickC;
                thicknessY = thickS;
                break;
            }
            case 1: {
                thicknessX = thickT;
                thicknessY = thickS;
                break;
            }
            case 2: {
                thicknessX = thickT;
                thicknessY = thickC;
                break;
            }
        }

        //转换成屏幕上的层厚
        thicknessX = (thicknessX / this.#initPixelSpacing) * Number(this.#GPARA.scale);
        thicknessY = (thicknessY / this.#initPixelSpacing) * Number(this.#GPARA.scale);

        thicknessX = thicknessX / 2;
        thicknessY = thicknessY / 2;

        // Update lines based on orthogonal mode
        let line = [
            {
                strokeStyle: this.#positionLine.colorX,
                c: { x1: -3000, y1: 0, x2: -5, y2: 0 },
                dottSytle: this.#positionLine.dottedLine1
            },
            {
                strokeStyle: this.#positionLine.colorX,
                c: { x1: 5, y1: 0, x2: 3000, y2: 0 },
                dottSytle: this.#positionLine.dottedLine1
            },
            {
                strokeStyle: this.#positionLine.colorY,
                c: { x1: 0, y1: -3000, x2: 0, y2: -5 },
                dottSytle: this.#positionLine.dottedLine2
            },
            {
                strokeStyle: this.#positionLine.colorY,
                c: { x1: 0, y1: 5, x2: 0, y2: 3000 },
                dottSytle: this.#positionLine.dottedLine2
            }
        ];

        if (thicknessX > 1) {
            for (let i = 0; i < 2; i++) {
                let ele1 = JSON.parse(JSON.stringify(line[i]));
                ele1.dottSytle = this.#positionLine.thickLine;
                ele1.c.y1 = -thicknessX;
                ele1.c.y2 = -thicknessX;
                line.push(ele1);
                let ele2 = JSON.parse(JSON.stringify(ele1));
                ele2.c.y1 = thicknessX;
                ele2.c.y2 = thicknessX;
                line.push(ele2);
            }
        }
        if (thicknessY > 1) {
            for (let i = 2; i < 4; i++) {
                let ele1 = JSON.parse(JSON.stringify(line[i]));
                ele1.dottSytle = this.#positionLine.thickLine;
                ele1.c.x1 = -thicknessY;
                ele1.c.x2 = -thicknessY;
                line.push(ele1);
                let ele2 = JSON.parse(JSON.stringify(ele1));
                ele2.c.x1 = thicknessY;
                ele2.c.x2 = thicknessY;
                line.push(ele2);
            }
        }

        // Ensure orthogonal mode maintains the 90-degree angle between the lines
        if (isOrthogonalMode) {
            line[2].c = { x1: 0, y1: -3000, x2: 0, y2: -5 };
            line[3].c = { x1: 0, y1: 5, x2: 0, y2: 3000 };
        }

        // Draw the lines
        for (let i = 0; i < line.length; i++) {
            this.drawLine(ctx, line[i].c, line[i].dottSytle, line[i].strokeStyle);
        }

        // Draw circles and rectangles (as before)
        this.drawShapes(ctx, screenPos, circleDis, rectDis);
        ctx.restore();
    }
    drawShapes (ctx, screenPos, circleDis, rectDis) {
        // 绘制圆形
        if (circleDis > 0) {
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, circleDis, 0, Math.PI * 2, false);
            ctx.strokeStyle = 'blue';  // 圆形的边框颜色，可以根据需求修改
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.closePath();
        }

        // 绘制矩形
        if (rectDis.width > 0 && rectDis.height > 0) {
            ctx.beginPath();
            ctx.rect(screenPos.x - rectDis.width / 2, screenPos.y - rectDis.height / 2, rectDis.width, rectDis.height);
            ctx.strokeStyle = 'red';  // 矩形的边框颜色，可以根据需求修改
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.closePath();
        }
    }

    drawLine (ctx, c, dottSytle, strokeStyle) {
        ctx.strokeStyle = strokeStyle;

        // 确保 dottSytle 是一个有效的数组
        if (Array.isArray(dottSytle) && dottSytle.every(Number.isFinite)) {
            ctx.setLineDash(dottSytle);
        } else {
            // 如果 dottSytle 不是有效的数组，使用默认的实线
            ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.moveTo(c.x1, c.y1);
        ctx.lineTo(c.x2, c.y2);
        ctx.stroke();
        // ctx.closePath();
    }


    drawCircle (ctx, c, ifFill, strokeStyle, fillStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.fillStyle = fillStyle;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, 2 * Math.PI);
        ctx.stroke();
        if (ifFill) {
            ctx.fill();
        }
        ctx.closePath();
    }
    drawRect (ctx, c, ifFill, strokeStyle, fillStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.fillStyle = fillStyle;
        ctx.beginPath();
        ctx.rect(c.x - c.r, c.y - c.r, 2 * c.r, 2 * c.r);
        ctx.stroke();
        if (ifFill) {
            ctx.fill();
        }
        ctx.closePath();
    }

    render2d () {
        this.refreshImg()
    }
    render3d () {
        this.#vtkRenderWindow.render()
        this.drawCrossOn3d()
    }
    getAxes (volumeOrigin, volumeSpacing, crossPosOnImage, rotateAngelGlobal) {
        //需要算上坐标原点和世界坐标系  
        const axes = mat4.identity(new Float64Array(16));

        //把坐标系原点平移到当前定位需要的点，平移移动的是世界坐标系
        let moveToCross = [
            volumeOrigin[0] + crossPosOnImage[0] * volumeSpacing[0],
            volumeOrigin[1] + crossPosOnImage[1] * volumeSpacing[1],
            volumeOrigin[2] + crossPosOnImage[2] * volumeSpacing[2]
        ]
        mat4.translate(axes, axes, moveToCross);

        //获取切片
        switch (this.#curViewMod) {
            case 0: {//x-y
                //旋转另外两个坐标轴
                mat4.rotateY(axes, axes, -rotateAngelGlobal[1]);
                mat4.rotateX(axes, axes, rotateAngelGlobal[2]);
                break
            }
            case 1: {//x-z
                //旋转另外两个坐标轴
                mat4.rotateZ(axes, axes, rotateAngelGlobal[0]);
                mat4.rotateX(axes, axes, rotateAngelGlobal[2]);
                //获得当前的截面
                mat4.rotateX(axes, axes, Math.PI / 2);
                break
            }
            case 2: {//y-z
                //旋转另外两个坐标轴
                mat4.rotateY(axes, axes, -rotateAngelGlobal[1]);
                mat4.rotateZ(axes, axes, rotateAngelGlobal[0]);
                //获得当前的截面
                mat4.rotateY(axes, axes, Math.PI / 2);
                mat4.rotateZ(axes, axes, Math.PI / 2);
                break
            }
        }
        return axes
    }

    getCrossPos (rotateAngelGlobal, curDWI) {
        //crossPosOnWorld 在当前坐标系下的位置始终是[0,0,0]
        let crossPosOnWorld = [0, 0, 0]
        let crossPos = {}
        switch (this.#curViewMod) {
            case 0: {//x-y
                crossPos.x = Math.round((crossPosOnWorld[0] - curDWI.leftTopPos.wA) / curDWI.pixelSpacingW)
                crossPos.y = Math.round((crossPosOnWorld[1] - curDWI.leftTopPos.hA) / curDWI.pixelSpacingH)
                crossPos.r = rotateAngelGlobal[0]
                break
            }
            case 1: {//x-z
                crossPos.x = Math.round((crossPosOnWorld[0] - curDWI.leftTopPos.wA) / curDWI.pixelSpacingW)
                crossPos.y = Math.round((crossPosOnWorld[2] - curDWI.leftTopPos.hA) / curDWI.pixelSpacingH)
                crossPos.r = rotateAngelGlobal[1]
                break
            }
            case 2: {//y-z
                crossPos.x = Math.round((crossPosOnWorld[1] - curDWI.leftTopPos.wA) / curDWI.pixelSpacingW)
                crossPos.y = Math.round((crossPosOnWorld[2] - curDWI.leftTopPos.hA) / curDWI.pixelSpacingH)
                crossPos.r = rotateAngelGlobal[2]
                break
            }
        }
        return crossPos
    }

    getDataWithInfo (slice, dataArray) {
        //渲染获得的数组
        let parat = {
            pixelSpacingW: slice.getSpacing()[0],
            pixelSpacingH: slice.getSpacing()[1],
            pixelSpacingD: slice.getSpacing()[2],
            leftTopPos: {
                wA: slice.getOrigin()[0],
                hA: slice.getOrigin()[1],
                dA: slice.getOrigin()[2],
            },
            origBuf: {
                width: slice.getDimensions()[0],
                height: slice.getDimensions()[1],
                data: dataArray
            },
            curViewMod: this.#curViewMod
        }
        let curDWI = new DataWithInfo(parat)
        return curDWI
    }
    getRenderScale (pixelSpacing, scale) {

        let newScale = pixelSpacing / this.#initPixelSpacing * scale
        return newScale
    }
    getContext () {
        return this.#renderCanvas.getContext('2d')
    }
    getCatcher () {
        return this.#catcherEngine
    }

    canvseToScreen (canvasPos, imatrix) {
        let { x, y } = canvasPos
        const {
            a, b, c,
            d, e, f
        } = imatrix

        const screenX = (c * y - d * x + d * e - c * f) / (b * c - a * d)
        const screenY = (y - screenX * b - f) / d

        return {
            x: Math.round(screenX),
            y: Math.round(screenY),
        }
    }

    screenToCanvas (screenPos, imatrix) {
        let { x, y } = screenPos
        const {
            a, b, c,
            d, e, f
        } = imatrix

        return {
            x: Math.round(x * a + y * c + e),
            y: Math.round(x * b + y * d + f)
        };
    }
}

export default RenderEngine;
