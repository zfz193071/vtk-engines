console.log("%crun datafomat", 'color:#0f0;')
import IMTA from "../util/imitation.js"
import { IMAGE_HEIGHT, IMAGE_WIDTH, CANVAS_HEIGHT, CANVAS_WIDTH } from "../util/DEFINE.js"
import RENADER from "../util/render.js"
import CIMG from "../util/cimg.js"

function getDataTest() {

}

iterTest()
function iterTest() {
    let imageWidth = IMAGE_WIDTH, imageHeight = IMAGE_HEIGHT
    let imageRenderWidth = IMAGE_WIDTH, imageRenderHeigth = IMAGE_HEIGHT
    let scaleOrg = { x: 1, y: 1 }, translateOrg = { x: 0, y: 0 }, rotateOrg = 0
    scaleOrg.y = imageHeight / IMAGE_HEIGHT
    let scale_opt = 1.5
    let _scale = { x: 1, y: 1 }, _translate = { x: 0, y: 0 }, _rotate = 0
    let tagScale = undefined

    let valueMax = 2000
    let valueMin = -1024
    let ww = 2000
    let wl = 1000
    let colormapIndex = "Rainbow"


    //测试两个方向缩放
    imageHeight = 192, imageWidth = 192
    imageRenderWidth = imageWidth, imageRenderHeigth = imageHeight
    scale_opt = 5



    //测试Y方向的缩放
    // imageHeight = 30, imageWidth = 512
    // scaleOrg.y = 5
    // imageRenderWidth = imageWidth, imageRenderHeigth = imageHeight * scaleOrg.y
    // scale_opt = 1.5

    //测试X方向的缩放
    // imageHeight = 512, imageWidth = 30
    // scaleOrg.x = 5
    // imageRenderWidth = imageWidth * scaleOrg.x, imageRenderHeigth = imageHeight
    // scale_opt = 1.5

    _scale.x = scaleOrg.x * scale_opt
    _scale.y = scaleOrg.y * scale_opt
    let orgdataObj = IMTA.create16BitData(imageWidth, imageHeight, valueMin, valueMax)
    tagScale = _scale
    //渲染原始图像
    let orgImageCanvas = CIMG.getRenderCImg(orgdataObj, colormapIndex, ww, wl, tagScale)
    let imgContent = document.getElementById('image')
    imgContent.style.width = imageRenderWidth.toString() + 'px'
    imgContent.style.height = imageRenderHeigth.toString() + 'px'
    RENADER.renderImage("imageRender", orgImageCanvas, scaleOrg, rotateOrg, translateOrg, imageRenderWidth, imageRenderHeigth)
    //渲染模拟render
    let rendeContent = document.getElementById('render')
    rendeContent.style.width = CANVAS_WIDTH.toString() + 'px'
    rendeContent.style.height = CANVAS_HEIGHT.toString() + 'px'
    rendeContent.style.top = (imageRenderHeigth + 20).toString() + 'px'
    RENADER.renderImage("mainRender", orgImageCanvas, _scale, _rotate, _translate, CANVAS_WIDTH, CANVAS_HEIGHT)

}


function test2() {
    let Len = 800 * 800
    let a = new Int16Array(Len)
    let b = new Int16Array(Len)
    let c = new Int16Array(Len)
    console.time("arrProBase")
    for (let i = 0; i < Len; i++) {
        a[i] = 1000
    }
    console.timeEnd("arrProBase")

    console.time("arrProBase")
    for (let i = 0; i < Len; i++) {
        b[i] = 2000
    }
    console.timeEnd("arrProBase")

    let aa = 0.3, bb = 0.7
    console.time("interProlatio_cpu")
    for (let i = 0; i < Len; i++) {
        c[i] = a[i] * aa + b[i] * bb
    }
    console.timeEnd("interProlatio_cpu")

    const interProlatio = gpu.createKernel(function (a, b, length, aa, bb) {
        let sum = a[this.thread.x] * aa + b[this.thread.x] * bb
        return sum;
    }).setOutput([Len]);
    console.time("interProlatio_gpu")
    c = interProlatio(a, b, Len, aa, bb);
    console.timeEnd("interProlatio_gpu")
}

function test1() {
    let a = 1.241, f = 50
    let b = new Uint8ClampedArray(1000 * 1000 * 4 * 100)
    let c = new Uint8ClampedArray(1000 * 1000 * 4 * 100)
    let d = new Uint8ClampedArray(1)
    console.time("math round")
    for (let i = 0; i < b.length; i++) {
        b[i] = Math.round(a * f)
    }
    console.timeEnd("math round")

    console.time("set Clamped")
    for (let i = 0; i < b.length; i++) {
        c[i] = a * f
    }
    console.timeEnd("set Clamped")
}

