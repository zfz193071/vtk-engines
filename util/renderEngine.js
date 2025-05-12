// 处理捕获器相关操作
import CatcherEngine from "./catcherEngine.js";
// 包含图像处理的相关方法
import CIMG from './cimg.js';
// 用于加载图像
import LOAD from './loadImg.js';
// 用于存储和管理图像数据及相关信息
import DataWithInfo from './tDataWithInfo.js';
// 用于进行 4x4 矩阵操作
const { mat4 } = glMatrix
class RenderEngine {
    // 类的构造函数，接收三个参数：rootDom（根 DOM 元素）、para（属性参数）和 GPARA（全局参数）
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
        // 创建一个全屏渲染窗口实例，将 #vtkRootDom 作为根容器，设置容器样式为高度和宽度均为 100%，背景颜色为黑色
        const fullScreenRenderer = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
            rootContainer: this.#vtkRootDom,
            containerStyle: {
                height: '100%',
                width: '100%'
            },
            background: [0, 0, 0]
        })
        let interactor = fullScreenRenderer.getInteractor();
        // 实例 interactorStyle，并移除所有鼠标操作器
        const interactorStyle = vtk.Interaction.Style.vtkInteractorStyleManipulator.newInstance();
        interactorStyle.removeAllMouseManipulators();
        // interactor.unbindEvents();
        interactor.setInteractorStyle(interactorStyle);

        // 获取渲染窗口和渲染器，并分别赋值给私有属性 #vtkRenderWindow 和 #vtkRenderer
        this.#vtkRenderWindow = fullScreenRenderer.getRenderWindow()
        this.#vtkRenderer = fullScreenRenderer.getRenderer()

        // 创建一个新的 canvas 元素 #renderCanvas3D，设置其样式为绝对定位，顶部和左侧位置为 0px，
        // 宽度和高度与 #renderCanvas 相同
        this.#renderCanvas3D = document.createElement("canvas")
        this.#renderCanvas3D.style.position = "absolute"
        this.#renderCanvas3D.style.top = "0px"
        this.#renderCanvas3D.style.left = "0px"
        this.#renderCanvas3D.width = this.#renderCanvas.width
        this.#renderCanvas3D.height = this.#renderCanvas.height
        this.#vtkRootDom.appendChild(this.#renderCanvas3D)


        //初始化#catcherEngine
        this.#catcherEngine = new CatcherEngine(this.#renderCanvas3D)
        // 设置全局参数
        this.#catcherEngine.setGPARA(GPARA)
        //初始化catcher的操作
        this.#catcherEngine.setRender(this)

        this.isOrthogonalRotation = false; // 添加开关变量
    }
    setOrthogonalRotation (enabled) {
        this.isOrthogonalRotation = enabled;
    }
    // 声明一系列私有属性，用于存储各种状态和参数，包括捕获器引擎、渲染画布、渲染上下文、渲染窗口、渲染器
    #catcherEngine = null
    #renderCanvas = null
    #renderCanvas3D = null
    #renderContext = null
    #vtkRootDom = null
    #vtkRenderWindow = null
    #vtkRenderer = null
    #vtkImgReslice = null

    // 数据源、裁剪平面、图像数据、像素间距、视图模式、融合透明度
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

    // 属性
    #props = {
        backgroupCanvas: "#000",
        borderColor: "#fff",
        rangeSize: [300, 300]
    }
    // 颜色参数
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
    // 变换参数、厚度、十字定位位置
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
    // 新坐标轴、颜色
    #newaxes = { newX: [1, 0, 0], newY: [0, 1, 0], newZ: [0, 0, 1], newCenter: [128, 128, 60] }
    #colorS = "#3470d8"
    #colorC = "#cd9700"
    #colorT = "#8a00da"
    // 十字线样式
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
        curViewMod3: {
            colorX: this.#colorT,
            colorY: this.#colorC,
            dottedLine1: [],
            dottedLine2: [],
            thickLine: [7, 5]
        },
    }
    // 选择的圆形和矩形
    #circleChoosed = null
    #rectChoosed = null

    getContainer () {
        return this.#vtkRootDom
    }
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
        // 设置捕获器的当前视图模式
        this.#catcherEngine.setCurViewMod(curViewMod)
    }
    // 设置 2D 缩放
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
        // 将世界坐标转换为归一化显示坐标，更新 #crossOn3DScreen 属性
        let displayCoords = this.#vtkRenderer.worldToNormalizedDisplay(newCenter[0], newCenter[1], newCenter[2], 1)
        this.#crossOn3DScreen = { x: displayCoords[0] * this.#renderCanvas.width, y: (1 - displayCoords[1]) * this.#renderCanvas.height, z: displayCoords[2], r: rotateAngelGlobal[this.#curViewMod] }
    }
    // 设置医学图像窗口宽度（WW, Window Width）和窗口中心（WL, Window Level）的函数，
    // 常用于控制CT/MRI 图像的对比度和亮度
    // ww: 窗口宽度（Window Width）——影响图像的对比度
    // wl: 窗口中心（Window Level）——影响图像的亮度
    setWWWL (ww, wl) {
        this.#colorPara_base.ww = ww
        this.#colorPara_base.wl = wl
        // "B&W" 表示当前色表为黑白色（Black & White）
        if (this.#vtkSource) this.#vtkSource.setWWWL(ww, wl, "B&W")
    }
    // 设置映射器和演员方法
    setMapperActor (source) {
        const vtkPlane = vtk.Common.DataModel.vtkPlane
        // 创建两个新的 vtkPlane 实例作为裁剪平面
        this.#clipPlane1 = vtkPlane.newInstance();
        this.#clipPlane2 = vtkPlane.newInstance();
        source.Mapper.addClippingPlane(this.#clipPlane1);
        source.Mapper.addClippingPlane(this.#clipPlane2);
        this.#vtkSource = source
        // 获取 #vtkSource 的患者体积的像素间距并赋值给 #initPixelSpacing
        this.#initPixelSpacing = this.#vtkSource.patientVolume.getSpacing()[0]
        this.#vtkRenderer.addActor(source.Actor)
        //增加平面
    }
    getActor () {
        return this.#vtkSource.Actor
    }
    getReslice () {
        return this.#vtkImgReslice
    }
    getRenderer () {
        return this.#vtkRenderer;
    }
    getRendererWindow () {
        return this.#vtkRenderWindow
    }
    // 设置页面方法（旧版）
    // 根据当前视图模式计算裁剪平面的法线和原点，并设置裁剪平面的属性
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

    // 设置十字定位方法
    // 根据患者体积的原点、间距、十字定位位置和旋转角度计算坐标轴和裁剪平面的法线、原点，
    // 并设置裁剪平面的属性
    // crossPosOnImage：图像空间中的十字线位置（如 [s, c, t]）
    // thicknessArr：层厚数组，分别表示 T/C/S 三个方向的厚度
    // rotateAngelGlobal：全局旋转角度数组，对应 T/C/S 三个方向
    setCross (crossPosOnImage, thicknessArr, rotateAngelGlobal) {
        // 获取当前体积数据（volume）对象
        let patientVolume = this.#vtkSource.patientVolume
        // origin 是体数据的起点坐标（世界坐标系）
        let volumeOrigin = patientVolume.getOrigin()
        // spacing 是每个像素/体素的物理间距
        let volumeSpacing = patientVolume.getSpacing()
        let clipPlaneNormal1, clipPlaneNormal2, clipPlaneOrigin1 = [], clipPlaneOrigin2 = []
        // 通过体素位置和旋转角度，计算一个 变换矩阵（4x4），描述了当前视图的方向和原点
        const axes = this.getAxes(volumeOrigin, volumeSpacing, crossPosOnImage, rotateAngelGlobal)
        // 从 4×4 的 axes 矩阵中提取：
        // newX：X轴方向（横向线方向）
        // newY：Y轴方向（纵向线方向）
        // newZ：Z轴方向（层厚方向）
        // newCenter：当前截面中心在世界坐标中的位置
        let newX = [axes[0], axes[1], axes[2]]
        let newY = [axes[4], axes[5], axes[6]]
        let newZ = [axes[8], axes[9], axes[10]]
        //截取平面时坐标原点的世界坐标
        let newCenter = [axes[12], axes[13], axes[14]]
        // 存储当前截面坐标系统，用于其他模块（比如拖动、旋转十字线）
        this.#newaxes = { newX, newY, newZ, newCenter }
        // 根据当前视图模式（T/C/S），获取当前方向上的层厚
        this.#thickness = thicknessArr[this.#curViewMod]
        // clipPlaneNormal1 与 clipPlaneNormal2 是 两个相反方向的法向量，用于两个反向平面的裁剪
        clipPlaneNormal1 = [newZ[0], newZ[1], newZ[2]]
        clipPlaneNormal2 = [-newZ[0], -newZ[1], -newZ[2]]
        // 从 newCenter 出发，沿 Z 方向的正负方向偏移一半的层厚，得到两个平面的位置
        // 这两个平面形成一个 slab（截面厚度区间）
        for (let i = 0; i < 3; i++) {
            clipPlaneOrigin1[i] = newCenter[i] - this.#thickness / 2 * newZ[i]
            clipPlaneOrigin2[i] = newCenter[i] + this.#thickness / 2 * newZ[i]
        }
        // 将计算出的 法向量和原点 应用到两个 vtkPlane 对象上
        // 通常这两个平面被用于设置 vtkImageReslice 或 vtkVolumeMapper 的剪裁
        this.#clipPlane1.setNormal(clipPlaneNormal1);
        this.#clipPlane1.setOrigin(clipPlaneOrigin1);
        this.#clipPlane2.setNormal(clipPlaneNormal2);
        this.#clipPlane2.setOrigin(clipPlaneOrigin2);
    }
    // 声明三个私有变量，用于记录十字定位的移动、厚度调整和旋转操作的开始状态
    #crossMoveStart = false
    #crossThickStart = false
    #crossRotateStart = false
    // 根据捕获器设置十字定位方法
    // 根据 flag 参数的值（start、end 或 move）执行不同的操作
    setCrossFromCatcher (pos, flag) {
        // 当 flag 为 start 时，根据选择的圆形或矩形设置相应的操作开始状态，
        // 并将鼠标样式设置为不可见
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
        // 当 flag 为 end 时，重置操作开始状态，调用 drawCrossOn3d 方法绘制十字定位，
        // 并将鼠标样式设置为默认
        if (flag === "end") {
            this.#crossMoveStart = false
            this.#crossThickStart = false
            this.#crossRotateStart = false
            this.drawCrossOn3d(pos)
            //设置鼠标样式为默认
            this.#catcherEngine.getCatrcherDom().style.cursor = "default"
        }
        // 当 flag 为 move 时，根据操作开始状态执行相应的操作，
        // 如移动十字定位、旋转十字定位或调整层厚，并更新 #GPARA 的值
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
            if (this.#crossThickStart) {
                let { imatrix, axes } = this.#crossThickStart
                let end = this.screenToCanvas(pos, imatrix)  //去除旋转的影响
                let newThick
                if (axes == 'x') {
                    newThick = Math.abs(end.y)
                } else {
                    newThick = Math.abs(end.x)
                }
                newThick = 2 * newThick * this.#initPixelSpacing / Number(this.#GPARA.scale)
                let minThick = 1
                let temp = this.#GPARA
                if (this.#curViewMod === 0) {
                    if (axes === "x") {
                        temp.thickC = newThick
                    }
                    if (axes === "y") {
                        temp.thickS = newThick
                    }
                }
                if (this.#curViewMod === 1) {
                    if (axes === "x") {
                        temp.thickT = newThick
                    }
                    if (axes === "y") {
                        temp.thickS = newThick
                    }
                }
                if (this.#curViewMod === 2) {
                    if (axes === "x") {
                        temp.thickT = newThick
                    }
                    if (axes === "y") {
                        temp.thickC = newThick
                    }
                }
                //层厚不能小于最小值
                Number(temp.thickS) < minThick ? temp.thickS = minThick : temp.thickS = Number((Math.round(temp.thickS * 100) / 100).toFixed(2))
                Number(temp.thickC) < minThick ? temp.thickC = minThick : temp.thickC = Number((Math.round(temp.thickC * 100) / 100).toFixed(2))
                Number(temp.thickT) < minThick ? temp.thickT = minThick : temp.thickT = Number((Math.round(temp.thickT * 100) / 100).toFixed(2))
                this.#GPARA.value = { ...temp }

            }
        }
    }

    // 计算向量夹角方法
    // 用于计算两个向量之间的夹角，使用 Math.atan2 函数计算向量的夹角
    getAngle (vecA, vecB) {
        let angle = Math.atan2(vecB[1], vecB[0]) - Math.atan2(vecA[1], vecA[0])
        return angle
    }
    // 计算旋转后的向量
    // 使用三角函数计算旋转后的向量
    getNewVec (vec, angle) {
        let newVec = [vec[0] * Math.cos(angle) - vec[1] * Math.sin(angle), vec[0] * Math.sin(angle) + vec[1] * Math.cos(angle)]
        return newVec
    }
    // 设置图像重采样方法
    setImageReslice (crossPosOnImage, thicknessArr, rotateArr) {

        // 创建一个 vtkImageReslice 实例，设置输入数据、输出维度、平板模式、输出数据类型、
        // 插值模式和变换输入采样
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
        // 调用 getAxes 方法计算坐标轴，设置重采样轴和切片数量
        let axes = this.getAxes(volumeOrigin, volumeSpacing, crossPosOnImage, rotateArr)
        imageReslice.setSlabNumberOfSlices(this.#thickness);
        imageReslice.setResliceAxes(axes)
        this.#vtkImgReslice = imageReslice
        let obliqueSlice = imageReslice.getOutputData();
        let dataArray = obliqueSlice.getPointData().getScalars().getData();
        // 调用 getDataWithInfo 方法获取图像数据及相关信息
        let curDWI = this.getDataWithInfo(obliqueSlice, dataArray)
        // 调用 loadBaseData 方法加载基础数据
        this.loadBaseData(curDWI)
        // 调用 getCrossPos 方法计算十字定位位置
        this.#crossPos = this.getCrossPos(rotateArr, curDWI)
        switch (this.#curViewMod) { }
    }
    // 加载混合数据方法
    loadMixData (dataWithInfo_base, dataWithInfo_fusion) {
        this.#dataWithInfo_base = dataWithInfo_base
        this.#dataWithInfo_fusion = dataWithInfo_fusion
        // 更新混合图像
        this.updateImgFromMix()
    }
    // 加载基础数据
    loadBaseData (dataWithInfo) {
        this.#dataWithInfo_base = dataWithInfo
        // 设置当前视图模式为 dataWithInfo.curViewMod，
        // 并调用 updateFromBase 方法更新基础图像
        this.#curViewMod = dataWithInfo.curViewMod
        this.updateFromBase()
    }

    // 更新基础图像
    updateFromBase () {
        if (!this.#dataWithInfo_base) return
        if (!this.#dataWithInfo_base.origBuf) return
        // 如果 #dataWithInfo_base.origBuf 是彩图，
        // 则将图像数据绘制到 this.imageData.img 上
        if (this.#dataWithInfo_base.origBuf.isColor) {
            //是彩图
            renderData = origBuf;
            this.imageData.img.width = renderData.width;
            this.imageData.img.height = renderData.height;
            let ctx = this.imageData.img.getContext("2d");
            ctx.putImageData(renderData, 0, 0);
        }
        // 从 #colorPara_base 中获取色表索引、窗口宽度和窗口中心，
        // 设置目标缩放比例为 { x: 1, y: 1 }
        let { colormapIndex, ww, wl } = this.#colorPara_base
        let tarScale = { x: 1, y: 1 }
        // 调用 CIMG.getRenderCImg 方法获取渲染后的图像，并赋值给 #imgCanvas
        this.#imgCanvas = CIMG.getRenderCImg(this.#dataWithInfo_base.origBuf, colormapIndex, ww, wl, tarScale, this.#imgCanvas)
    }

    // 更新混合图像
    updateMixImg () {
        // 检查基础数据是否存在，若不存在则直接返回，不执行后续操作
        if (!this.#dataWithInfo_base) return
        // 检查基础数据的原始缓冲区是否存在，若不存在则直接返回
        if (!this.#dataWithInfo_base.origBuf) return
        // 检查融合数据是否存在，若不存在则直接返回
        if (!this.#dataWithInfo_fusion) return
        // 检查融合数据的原始缓冲区是否存在，若不存在则直接返回
        if (!this.#dataWithInfo_fusion.origBuf) return

        //计算PT到CT的缩放和转换参数，这些参数用于后续图像融合
        let { scalePTtoCT, transPTtoCT } = LOAD.getFusionPara(
            this.#dataWithInfo_base,
            this.#dataWithInfo_fusion,
            this.#curViewMod
        );

        //暂时不考虑缩放过的情况
        let tarScale = { x: 1, y: 1 }
        //获取renderData
        // 获取基础数据的渲染数据，根据基础颜色参数和目标缩放比例进行渲染
        let { colormapIndex: colormapIndex1, ww: ww1, wl: wl1 } = this.#colorPara_base
        let ct_renderData = CIMG.getRenderData(
            this.#dataWithInfo_base,
            colormapIndex1,
            ww1,
            wl1,
            tarScale
        );
        // 获取融合数据的渲染数据，根据融合颜色参数和目标缩放比例进行渲染
        let { colormapIndex: colormapIndex2, ww: ww2, wl: wl2 } = this.#colorPara_fusion
        let pt_renderData = CIMG.getRenderData(
            this.imageData.dataWithInfo.origBuf,
            colormapIndex2,
            ww2,
            wl2,
            tarScale
        );
        // 融合基础数据和融合数据的渲染结果，得到最终的混合图像
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
    // 该函数用于刷新图像，先清除画布并填充黑色，然后绘制图像（包含变换操作），最后绘制十字定位线
    refreshImg () {
        // 从变换参数对象中解构出缩放、旋转和平移参数
        let { scale, rotate, translate } = this.#transformPara
        // 清除渲染画布的内容，准备重新绘制
        this.#renderContext.clearRect(0, 0, this.#renderCanvas.width, this.#renderCanvas.height)
        // 设置填充颜色为黑色
        let color = "#000";
        this.#renderContext.fillStyle = color;
        // 使用黑色填充整个渲染画布
        this.#renderContext.fillRect(0, 0, this.#renderCanvas.width, this.#renderCanvas.height)
        // 在画布上绘制图像，并应用缩放、旋转和平移变换
        this.ctxDrawImage(this.#renderContext, this.#imgCanvas, scale, rotate, translate, this.#renderCanvas.width, this.#renderCanvas.height)
        // 在画布上绘制十字定位线
        this.drawCross(this.#renderContext)
    }
    // 该函数用于在画布上绘制图像，支持调窗后的缩放，
    // 绘制过程包括保存画布状态、缩放、平移、旋转等变换操作，
    // 最后绘制图像并恢复画布状态
    ctxDrawImage (
        canvasEle_ctx,
        image,
        scale,
        rotate,
        translate,
        canvasWidth,
        canvasHeight
    ) {
        // 如果图像不存在，则不执行后续绘制操作，直接返回
        if (!image) return
        // 复制当前缩放参数，以便后续可能的修改
        let scaleCur = { ...scale },
            imageCur = image;
        // 检查图像是否有调窗后的缩放信息
        let { ifInterPro, interCImg } = image;
        // 如果存在调窗后的缩放信息
        if (ifInterPro && interCImg) {
            // 计算调窗后的缩放比例
            let scale_self = {
                x: interCImg.width / image.width,
                y: interCImg.height / image.height,
            };
            // 根据调窗后的缩放比例调整当前缩放参数
            scaleCur.x = scale.x / scale_self.x;
            scaleCur.y = scale.y / scale_self.y;
            // 更新当前图像为调窗后的图像
            imageCur = interCImg;
        }
        // 保存当前画布状态，以便后续恢复
        canvasEle_ctx.save();
        // 应用缩放变换
        canvasEle_ctx.scale(scaleCur.x, scaleCur.y);
        // 计算平移到图像中心的偏移量
        let tempX =
            (canvasWidth / 2 + translate.x) / scaleCur.x - imageCur.width / 2;
        let tempY =
            (canvasHeight / 2 + translate.y) / scaleCur.y - imageCur.height / 2;
        // 执行平移变换
        canvasEle_ctx.translate(tempX, tempY);
        // 先平移到图像中心，为旋转做准备
        canvasEle_ctx.translate(imageCur.width / 2, imageCur.height / 2);
        // 恢复缩放，使旋转基于原始图像大小
        canvasEle_ctx.scale(1 / scaleCur.x, 1 / scaleCur.y);
        // 执行旋转变换
        canvasEle_ctx.rotate(rotate);
        // 再次应用缩放
        canvasEle_ctx.scale(scaleCur.x, scaleCur.y);
        // 平移回图像左上角
        canvasEle_ctx.translate(-imageCur.width / 2, -imageCur.height / 2);
        // 在画布上绘制图像
        canvasEle_ctx.drawImage(imageCur, 0, 0);
        // 恢复画布到保存时的状态
        canvasEle_ctx.restore();
    }

    //十字定位
    // 该函数用于在画布上绘制十字定位线，先判断十字定位位置是否存在，
    // 然后转换坐标，保存画布状态，进行平移和旋转，绘制十字线，
    // 最后恢复画布状态
    drawCross (ctx) {
        // 如果十字定位位置信息不存在，则不执行绘制操作，直接返回
        if (!this.#crossPos) {
            return;
        }
        // 从变换参数对象中解构出平移、旋转和缩放参数
        let { translate, rotate, scale } = this.#transformPara
        // 从十字定位位置对象中解构出坐标和旋转角度
        let { x, y, r = 0 } = this.#crossPos;
        // 获取当前图像的宽度和高度
        let width = this.#imgCanvas.width;
        let height = this.#imgCanvas.height;
        // 将图像坐标转换为画布坐标
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
        // 保存当前画布状态
        ctx.save();
        // 平移画布到十字定位点
        ctx.translate(point.x, point.y);
        // 旋转画布到十字定位的旋转角度
        ctx.rotate(r);

        let l = 3000;
        // 设置线条宽度为1
        ctx.lineWidth = 1;
        ctx.lineWidth = 1;
        // 获取当前视图模式对应的十字线颜色和样式
        let { colorX, colorY, dottedLine1, dottedLine2 } = this.#positionLine["curViewMod" + this.#curViewMod]

        // 设置线条颜色为colorX，设置虚线样式，绘制X轴正向和负向的线段
        ctx.strokeStyle = colorX;
        ctx.setLineDash(dottedLine1);
        ctx.beginPath();
        ctx.moveTo(-5, 0);
        ctx.lineTo(-l, 0);
        ctx.stroke();

        ctx.moveTo(5, 0);
        ctx.lineTo(l, 0);
        ctx.stroke();

        // 设置线条颜色为colorY，设置虚线样式，绘制Y轴正向和负向的线段
        ctx.strokeStyle = colorY;
        ctx.setLineDash(dottedLine2);
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(0, -l);
        ctx.stroke();

        ctx.moveTo(0, 5);
        ctx.lineTo(0, l);
        ctx.stroke();
        // 恢复画布到保存时的状态
        ctx.restore();
    }

    // 主要功能是在 3D 渲染画布上绘制十字线以及相关的交互元素（圆形和矩形），
    // 并且根据鼠标位置和操作状态（旋转、调整厚度）来高亮显示这些交互元素
    drawCrossOn3d (screenPos = {}) {
        // 获取3D渲染画布的2D上下文，后续将在这个上下文中进行绘制操作
        let ctx = this.#renderCanvas3D.getContext("2d")
        // 清除3D渲染画布上之前绘制的所有内容，准备重新绘制
        ctx.clearRect(0, 0, this.#renderCanvas3D.width, this.#renderCanvas3D.height)
        // 保存当前画布的状态，包括当前的变换矩阵、线条样式等，以便后续恢复
        ctx.save();
        // 将画布的原点平移到3D屏幕上十字中心点的位置，方便后续以该点为基准进行绘制
        ctx.translate(this.#crossOn3DScreen.x, this.#crossOn3DScreen.y);
        // 将画布绕原点旋转指定的角度，使得后续绘制的内容与十字的旋转状态一致
        ctx.rotate(this.#crossOn3DScreen.r);

        // 定义一些常量，用于控制绘制元素的尺寸和交互范围
        let Dis = 60, rForCircle = 5, rForRect = 4, findRange = 10
        // 计算圆形和矩形的偏移距离
        let circleDis = 2 * Dis, rectDis = Dis

        // 声明变量，用于存储X和Y方向的厚度
        let thicknessX, thicknessY
        // 从全局参数对象中解构出三个方向的厚度值
        let { thickT, thickC, thickS } = this.#GPARA
        // 将这些厚度值转换为数字类型，确保后续计算的准确性
        thickT = Number(thickT); thickC = Number(thickC); thickS = Number(thickS)

        // 根据当前视图模式，选择对应的厚度方向，并将其赋值给 thicknessX 和 thicknessY
        switch (this.#curViewMod) {
            case 0: {
                // 在视图模式0下，X方向厚度为 thickC，Y方向厚度为 thickS
                thicknessX = thickC
                thicknessY = thickS
                break
            }
            case 1: {
                // 在视图模式1下，X方向厚度为 thickT，Y方向厚度为 thickS
                thicknessX = thickT
                thicknessY = thickS
                break
            }
            case 2: {
                // 在视图模式2下，X方向厚度为 thickT，Y方向厚度为 thickC
                thicknessX = thickT
                thicknessY = thickC
                break
            }
        }
        // 将厚度值从原始单位转换为屏幕上的实际单位，考虑了像素间距和全局缩放比例
        thicknessX = (thicknessX / this.#initPixelSpacing) * Number(this.#GPARA.scale)
        thicknessY = (thicknessY / this.#initPixelSpacing) * Number(this.#GPARA.scale)

        // 为了绘制 ± 厚度的一半线，将厚度值除以2
        thicknessX = thicknessX / 2
        thicknessY = thicknessY / 2

        // 初始化一个标记对象，用于记录是否需要显示圆形和矩形交互元素
        let flag = { circleShow: false, rectShow: false, rectShowX: false, rectShowY: false }
        // 声明一个对象，用于存储转换后的画布坐标
        let canvasPos = {}
        // 获取当前画布的变换矩阵，该矩阵包含了平移、旋转等变换信息
        const transform = ctx.getTransform()
        // 计算变换矩阵的逆矩阵，用于将屏幕坐标转换为画布坐标
        const imatrix = transform.invertSelf()
        // 检查传入的屏幕坐标是否有效
        if (screenPos.x && screenPos.y) {
            // 如果有效，将屏幕坐标转换为画布坐标
            canvasPos = this.screenToCanvas(screenPos, imatrix)
            // 解构出画布坐标的x和y值
            let { x, y } = canvasPos
            // 检查画布坐标是否有效
            if (x && y) {
                // 判断鼠标是否靠近十字中心位置，如果是，则需要显示圆形和矩形交互元素
                if (Math.abs(x) < findRange || Math.abs(y) < findRange) {
                    flag.circleShow = true
                    flag.rectShow = true
                }
                // 判断鼠标是否靠近X方向的厚度边缘位置，如果是，则需要显示圆形和矩形交互元素
                if (thicknessX > 1 && (Math.abs(y - thicknessX) < findRange || Math.abs(y + thicknessX) < findRange)) {
                    flag.circleShow = true
                    flag.rectShow = true
                }
                // 判断鼠标是否靠近Y方向的厚度边缘位置，如果是，则需要显示圆形和矩形交互元素
                if (thicknessY > 1 && (Math.abs(x - thicknessY) < findRange || Math.abs(x + thicknessY) < findRange)) {
                    flag.circleShow = true
                    flag.rectShow = true
                }
            }
        }

        // 如果正在进行十字旋转操作，则显示圆形交互元素，隐藏矩形交互元素
        if (this.#crossRotateStart) {
            flag.circleShow = true
            flag.rectShow = false
        }
        // 如果正在进行十字厚度调整操作，则显示矩形交互元素，隐藏圆形交互元素
        if (this.#crossThickStart) {
            flag.rectShow = true
            flag.circleShow = false
        }

        // 定义一个常量，用于控制线条的长度
        let l = 3000
        // 定义一个常量，用于控制线条的截断距离
        let CD = 5

        // 设置画布的线条宽度为2像素
        ctx.lineWidth = 2;
        // 从当前视图模式对应的配置对象中解构出十字线的颜色、虚线样式和粗线样式
        let { colorX, colorY, dottedLine1, dottedLine2, thickLine } = this.#positionLine["curViewMod" + this.#curViewMod]

        // 定义一个数组，用于存储十字线的线段信息
        let line = [
            {
                // X轴负方向的线段，颜色为 colorX，虚线样式为 dottedLine1
                strokeStyle: colorX,
                c: { x1: -l, y1: 0, x2: -CD, y2: 0 },
                dottSytle: dottedLine1
            },
            {
                // X轴正方向的线段，颜色为 colorX，虚线样式为 dottedLine1
                strokeStyle: colorX,
                c: { x1: CD, y1: 0, x2: l, y2: 0 },
                dottSytle: dottedLine1
            },
            {
                // Y轴负方向的线段，颜色为 colorY，虚线样式为 dottedLine2
                strokeStyle: colorY,
                c: { x1: 0, y1: -l, x2: 0, y2: -CD },
                dottSytle: dottedLine2
            },
            {
                // Y轴正方向的线段，颜色为 colorY，虚线样式为 dottedLine2
                strokeStyle: colorY,
                c: { x1: 0, y1: CD, x2: 0, y2: l },
                dottSytle: dottedLine2
            }
        ]
        // 如果X方向的厚度大于1像素，则需要添加表示厚度的粗线段
        if (thicknessX > 1) {
            // 遍历X轴的两条主线段
            for (let i = 0; i < 2; i++) {
                // 复制主线段的信息
                let ele1 = JSON.parse(JSON.stringify(line[i]))
                // 将虚线样式改为粗线样式
                ele1.dottSytle = thickLine
                // 将线段的Y坐标设置为负的厚度值
                ele1.c.y1 = -thicknessX
                ele1.c.y2 = -thicknessX
                // 将新线段添加到线段数组中
                line.push(ele1)
                // 复制另一条线段，将Y坐标设置为正的厚度值
                let ele2 = JSON.parse(JSON.stringify(ele1))
                ele2.c.y1 = thicknessX
                ele2.c.y2 = thicknessX
                // 将新线段添加到线段数组中
                line.push(ele2)
            }
        }
        // 如果Y方向的厚度大于1像素，则需要添加表示厚度的粗线段
        if (thicknessY > 1) {
            // 遍历Y轴的两条主线段
            for (let i = 2; i < 4; i++) {
                // 复制主线段的信息
                let ele1 = JSON.parse(JSON.stringify(line[i]))
                // 将虚线样式改为粗线样式
                ele1.dottSytle = thickLine
                // 将线段的X坐标设置为负的厚度值
                ele1.c.x1 = -thicknessY
                ele1.c.x2 = -thicknessY
                // 将新线段添加到线段数组中
                line.push(ele1)
                // 复制另一条线段，将X坐标设置为正的厚度值
                let ele2 = JSON.parse(JSON.stringify(ele1))
                ele2.c.x1 = thicknessY
                ele2.c.x2 = thicknessY
                // 将新线段添加到线段数组中
                line.push(ele2)
            }
        }
        // 遍历线段数组，调用 drawLine 方法绘制所有线段
        for (let i = 0; i < line.length; i++) {
            this.drawLine(ctx, line[i].c, line[i].dottSytle, line[i].strokeStyle)
        }

        // 定义一个数组，用于存储圆形交互元素的信息
        let circle = []
        // 如果需要显示圆形交互元素
        if (flag.circleShow) {
            // 初始化四个圆形交互元素的信息
            circle[0] = { c: { x: -circleDis, y: 0, r: rForCircle }, ifFill: false, strokeStyle: colorX, fillStyle: colorX }
            circle[1] = { c: { x: circleDis, y: 0, r: rForCircle }, ifFill: false, strokeStyle: colorX, fillStyle: colorX }
            circle[2] = { c: { x: 0, y: -circleDis, r: rForCircle }, ifFill: false, strokeStyle: colorY, fillStyle: colorY }
            circle[3] = { c: { x: 0, y: circleDis, r: rForCircle }, ifFill: false, strokeStyle: colorY, fillStyle: colorY }
        }
        // 重置选择的圆形交互元素为 null
        this.#circleChoosed = null
        // 遍历圆形数组
        for (let i = 0; i < circle.length; i++) {
            // 解构出画布坐标的x和y值
            let { x, y } = canvasPos
            // 判断鼠标是否在圆形附近，使用欧几里得距离进行判断
            if (x && y && Math.pow(circle[i].c.x - x, 2) + Math.pow(circle[i].c.y - y, 2) <= Math.pow(findRange, 2)) {
                // 如果在附近，则将圆形设置为填充状态
                circle[i].ifFill = true
                // 将选中的圆形坐标转换为屏幕坐标
                this.#circleChoosed = this.canvseToScreen(circle[i].c, imatrix)
            }
            // 如果正在进行十字旋转操作，则将所有圆形设置为填充状态
            if (this.#crossRotateStart) {
                circle[i].ifFill = true
            }
            // 调用 drawCircle 方法绘制圆形
            this.drawCircle(ctx, circle[i].c, circle[i].ifFill, circle[i].strokeStyle, circle[i].fillStyle)
        }

        // 定义一个数组，用于存储矩形交互元素的信息
        let rect = []
        // 重置选择的矩形交互元素为 null
        this.#rectChoosed = null
        // 声明一个变量，用于记录从X方向矩形到Y方向矩形的索引分界点
        let indexFromXtoY
        // 如果需要显示矩形交互元素
        if (flag.rectShow) {
            // 如果X方向的厚度大于1像素
            if (thicknessX > 1) {
                // 初始化四个矩形交互元素的信息，分别位于X方向厚度的上下边缘
                rect[0] = { c: { x: -rectDis, y: -thicknessX, r: rForRect }, ifFill: false, strokeStyle: colorX, fillStyle: colorX }
                rect[1] = { c: { x: rectDis, y: -thicknessX, r: rForRect }, ifFill: false, strokeStyle: colorX, fillStyle: colorX }
                rect[2] = { c: { x: -rectDis, y: thicknessX, r: rForRect }, ifFill: false, strokeStyle: colorX, fillStyle: colorX }
                rect[3] = { c: { x: rectDis, y: thicknessX, r: rForRect }, ifFill: false, strokeStyle: colorX, fillStyle: colorX }
            } else {
                // 如果X方向的厚度不大于1像素，初始化两个矩形交互元素的信息，位于X轴上
                rect[0] = { c: { x: -rectDis, y: 0, r: rForRect }, ifFill: false, strokeStyle: colorX, fillStyle: colorX }
                rect[1] = { c: { x: rectDis, y: 0, r: rForRect }, ifFill: false, strokeStyle: colorX, fillStyle: colorX }
            }
            // 记录从X方向矩形到Y方向矩形的索引分界点
            indexFromXtoY = rect.length

            // 如果Y方向的厚度大于1像素
            if (thicknessY > 1) {
                // 初始化四个矩形交互元素的信息，分别位于Y方向厚度的左右边缘
                rect[indexFromXtoY] = { c: { x: -thicknessY, y: -rectDis, r: rForRect }, ifFill: false, strokeStyle: colorY, fillStyle: colorY }
                rect[indexFromXtoY + 1] = { c: { x: -thicknessY, y: rectDis, r: rForRect }, ifFill: false, strokeStyle: colorY, fillStyle: colorY }
                rect[indexFromXtoY + 2] = { c: { x: thicknessY, y: -rectDis, r: rForRect }, ifFill: false, strokeStyle: colorY, fillStyle: colorY }
                rect[indexFromXtoY + 3] = { c: { x: thicknessY, y: rectDis, r: rForRect }, ifFill: false, strokeStyle: colorY, fillStyle: colorY }
            } else {
                // 如果Y方向的厚度不大于1像素，初始化两个矩形交互元素的信息，位于Y轴上
                rect[indexFromXtoY] = { c: { x: 0, y: -rectDis, r: rForRect }, ifFill: false, strokeStyle: colorY, fillStyle: colorY }
                rect[indexFromXtoY + 1] = { c: { x: 0, y: rectDis, r: rForRect }, ifFill: false, strokeStyle: colorY, fillStyle: colorY }
            }
        }
        // 遍历矩形数组
        for (let i = 0; i < rect.length; i++) {
            // 解构出画布坐标的x和y值
            let { x, y } = canvasPos
            // 判断鼠标是否在矩形附近，通过比较坐标差值是否在指定范围内
            if (x && y && Math.abs(rect[i].c.x - x) <= findRange && Math.abs(rect[i].c.y - y) <= findRange) {
                // 如果在附近，则将矩形设置为填充状态
                rect[i].ifFill = true
                // 将选中的矩形坐标转换为屏幕坐标
                this.#rectChoosed = this.canvseToScreen(rect[i].c, imatrix)
                // 设置选中矩形的类型
                this.#rectChoosed.type = rect[i].type
                // 根据索引判断矩形属于X方向还是Y方向
                if (i < indexFromXtoY) {
                    this.#rectChoosed.axes = "x"
                } else {
                    this.#rectChoosed.axes = "y"
                }
                // 记录选中矩形的逆变换矩阵
                this.#rectChoosed.imatrix = imatrix
            }
            // 如果正在进行十字厚度调整操作，则将所有矩形设置为填充状态
            if (this.#crossThickStart) {
                rect[i].ifFill = true
            }
            // 调用 drawRect 方法绘制矩形
            this.drawRect(ctx, rect[i].c, rect[i].ifFill, rect[i].strokeStyle, rect[i].fillStyle)
        }

        // 恢复之前保存的画布状态，包括变换矩阵、线条样式等
        ctx.restore();
    }

    drawLine (ctx, c, dottSytle, strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.setLineDash(dottSytle);
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
        // 创建一个 4x4 的单位矩阵，用于存储变换后的坐标轴信息
        // Float64Array(16) 表示创建一个长度为 16 的 64 位浮点数数组，这里存储矩阵元素
        const axes = mat4.identity(new Float64Array(16));

        // 计算将坐标系原点平移到当前定位所需点的偏移量
        // 这里结合了体数据的原点位置、十字线在图像上的位置以及体数据的间距
        let moveToCross = [
            volumeOrigin[0] + crossPosOnImage[0] * volumeSpacing[0],
            volumeOrigin[1] + crossPosOnImage[1] * volumeSpacing[1],
            volumeOrigin[2] + crossPosOnImage[2] * volumeSpacing[2]
        ];
        // 使用 mat4.translate 函数将单位矩阵 axes 沿着 moveToCross 向量进行平移
        mat4.translate(axes, axes, moveToCross);

        // 根据当前视图模式进行不同的旋转操作，以获取相应的切片
        switch (this.#curViewMod) {
            case 0: { // x - y 平面
                // 绕 Y 轴负方向旋转 rotateAngelGlobal[1] 角度
                mat4.rotateY(axes, axes, -rotateAngelGlobal[1]);
                // 绕 X 轴正方向旋转 rotateAngelGlobal[2] 角度
                mat4.rotateX(axes, axes, rotateAngelGlobal[2]);
                break;
            }
            case 1: { // x - z 平面
                // 绕 Z 轴正方向旋转 rotateAngelGlobal[0] 角度
                mat4.rotateZ(axes, axes, rotateAngelGlobal[0]);
                // 绕 X 轴正方向旋转 rotateAngelGlobal[2] 角度
                mat4.rotateX(axes, axes, rotateAngelGlobal[2]);
                // 绕 X 轴正方向旋转 π/2 弧度，以获得当前的截面
                mat4.rotateX(axes, axes, Math.PI / 2);
                break;
            }
            case 2: { // y - z 平面
                // 绕 Y 轴负方向旋转 rotateAngelGlobal[1] 角度
                mat4.rotateY(axes, axes, -rotateAngelGlobal[1]);
                // 绕 Z 轴正方向旋转 rotateAngelGlobal[0] 角度
                mat4.rotateZ(axes, axes, rotateAngelGlobal[0]);
                // 绕 Y 轴正方向旋转 π/2 弧度
                mat4.rotateY(axes, axes, Math.PI / 2);
                // 绕 Z 轴正方向旋转 π/2 弧度，以获得当前的截面
                mat4.rotateZ(axes, axes, Math.PI / 2);
                break;
            }
        }
        // 返回经过平移和旋转变换后的坐标轴矩阵
        return axes;
    }

    getCrossPos (rotateAngelGlobal, curDWI) {
        // 十字线在当前坐标系下的位置始终为 [0, 0, 0]
        let crossPosOnWorld = [0, 0, 0];
        // 用于存储十字线在屏幕上的位置和旋转角度
        let crossPos = {};
        // 根据当前视图模式计算十字线在屏幕上的位置和旋转角度
        switch (this.#curViewMod) {
            case 0: { // x - y 平面
                // 计算十字线在 x 方向的位置，四舍五入取整
                crossPos.x = Math.round((crossPosOnWorld[0] - curDWI.leftTopPos.wA) / curDWI.pixelSpacingW);
                // 计算十字线在 y 方向的位置，四舍五入取整
                crossPos.y = Math.round((crossPosOnWorld[1] - curDWI.leftTopPos.hA) / curDWI.pixelSpacingH);
                // 十字线的旋转角度为 rotateAngelGlobal[0]
                crossPos.r = rotateAngelGlobal[0];
                break;
            }
            case 1: { // x - z 平面
                // 计算十字线在 x 方向的位置，四舍五入取整
                crossPos.x = Math.round((crossPosOnWorld[0] - curDWI.leftTopPos.wA) / curDWI.pixelSpacingW);
                // 计算十字线在 y 方向的位置（这里实际对应 z 方向），四舍五入取整
                crossPos.y = Math.round((crossPosOnWorld[2] - curDWI.leftTopPos.hA) / curDWI.pixelSpacingH);
                // 十字线的旋转角度为 rotateAngelGlobal[1]
                crossPos.r = rotateAngelGlobal[1];
                break;
            }
            case 2: { // y - z 平面
                // 计算十字线在 x 方向的位置（这里实际对应 y 方向），四舍五入取整
                crossPos.x = Math.round((crossPosOnWorld[1] - curDWI.leftTopPos.wA) / curDWI.pixelSpacingW);
                // 计算十字线在 y 方向的位置（这里实际对应 z 方向），四舍五入取整
                crossPos.y = Math.round((crossPosOnWorld[2] - curDWI.leftTopPos.hA) / curDWI.pixelSpacingH);
                // 十字线的旋转角度为 rotateAngelGlobal[2]
                crossPos.r = rotateAngelGlobal[2];
                break;
            }
        }
        // 返回十字线在屏幕上的位置和旋转角度
        return crossPos;
    }

    getDataWithInfo (slice, dataArray) {
        // 用于存储渲染所需的参数
        let parat = {
            // 切片在宽度方向的像素间距
            pixelSpacingW: slice.getSpacing()[0],
            // 切片在高度方向的像素间距
            pixelSpacingH: slice.getSpacing()[1],
            // 切片在深度方向的像素间距
            pixelSpacingD: slice.getSpacing()[2],
            leftTopPos: {
                // 切片左上角在宽度方向的坐标
                wA: slice.getOrigin()[0],
                // 切片左上角在高度方向的坐标
                hA: slice.getOrigin()[1],
                // 切片左上角在深度方向的坐标
                dA: slice.getOrigin()[2],
            },
            origBuf: {
                // 切片的宽度
                width: slice.getDimensions()[0],
                // 切片的高度
                height: slice.getDimensions()[1],
                // 切片的数据数组
                data: dataArray
            },
            // 当前视图模式
            curViewMod: this.#curViewMod
        };
        // 使用 parat 参数创建一个 DataWithInfo 对象
        let curDWI = new DataWithInfo(parat);
        // 返回包含渲染信息的 DataWithInfo 对象
        return curDWI;
    }
    getRenderScale (pixelSpacing, scale) {
        // 根据像素间距和初始像素间距以及传入的缩放比例计算新的缩放比例
        let newScale = pixelSpacing / this.#initPixelSpacing * scale;
        // 返回新的缩放比例
        return newScale;
    }
    getContext () {
        // 获取渲染画布的 2D 上下文
        return this.#renderCanvas.getContext('2d');
    }
    getCatcher () {
        // 返回捕获引擎对象
        return this.#catcherEngine;
    }

    canvseToScreen (canvasPos, imatrix) {
        // 解构出画布坐标的 x 和 y 值
        let { x, y } = canvasPos;
        // 解构出逆变换矩阵的各个元素
        const {
            a, b, c,
            d, e, f
        } = imatrix;

        // 根据逆变换矩阵计算屏幕坐标的 x 值
        const screenX = (c * y - d * x + d * e - c * f) / (b * c - a * d);
        // 根据逆变换矩阵计算屏幕坐标的 y 值
        const screenY = (y - screenX * b - f) / d;

        // 返回四舍五入后的屏幕坐标
        return {
            x: Math.round(screenX),
            y: Math.round(screenY),
        };
    }

    screenToCanvas (screenPos, imatrix) {
        // 解构出屏幕坐标的 x 和 y 值
        let { x, y } = screenPos;
        // 解构出逆变换矩阵的各个元素
        const {
            a, b, c,
            d, e, f
        } = imatrix;

        // 根据逆变换矩阵计算画布坐标的 x 值，四舍五入取整
        return {
            x: Math.round(x * a + y * c + e),
            y: Math.round(x * b + y * d + f)
        };
    }
    getCrossOn3DScreen () {
        return this.#crossOn3DScreen;
    }
    getVolume () {
        return this.#vtkSource.patientVolume
    }

}

export default RenderEngine;
