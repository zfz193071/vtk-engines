import IMTA from "../public/imitation.js"
import CIMG from "../../../src/components/multiviewer/js/cimg.js"
import { IMAGE_HEIGHT, IMAGE_WIDTH, CANVAS_HEIGHT, CANVAS_WIDTH } from "../public/define.js"
import RENADER from "../public/render.js"
import SVGMARK from "../../../src/components/multiviewer/js/svgmark.js"

function newPlygonEle() {
    let polygonEle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
    polygonEle.style.fill = 'rgba(22,255,255,0.3)'
    polygonEle.style.stroke = 'rgba(22,255,255,1)'
    polygonEle.style["stroke-width"] = 2
    polygonEle.style['fill-rule'] = "evenodd"
    // 清空现有点
    polygonEle.points.clear()

    polygonEle.addEventListener('mouseover', e => {
        polygonEle.style.fill = 'rgba(22,255,255,0.5)'
        polygonEle.style.stroke = 'rgba(255,22,255,1)'
    })
    polygonEle.addEventListener('mouseout', e => {
        polygonEle.style.fill = 'rgba(22,255,255,0.3)'
        polygonEle.style.stroke = 'rgba(22,255,255,1)'
    })
    return polygonEle
}


function reflashSVG(_SVGEle, markPoints) {
    //清空子节点
    _SVGEle.remove()
    let polygonEle = newPlygonEle()
    //把坐标点渲染出来
    for (let i = 0; i < markPoints.length; i++) {
        //创建svgpoint
        let svgpoint = _SVGEle.createSVGPoint();
        svgpoint.x = markPoints[i].x;
        svgpoint.y = markPoints[i].y;
        polygonEle.points.appendItem(svgpoint)
    }
    _SVGEle.appendChild(polygonEle)
}

function setSVGMark(markPoints) {
    let svgEle = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEle.style.width = IMAGE_WIDTH
    svgEle.style.height = IMAGE_HEIGHT
    svgEle.style.position = "absolute"
    svgEle.style.top = '0px'
    svgEle.style.left = '0px'
    reflashSVG(svgEle, markPoints)
    let imageEle = document.getElementById("image")
    imageEle.appendChild(svgEle)
    return markPoints
}

async function drawSVGMark(polygonPonitList, scale, rotate, translate) {
    let svgEle = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEle.xmlns = "http://www.w3.org/2000/svg"
    svgEle.style.width = CANVAS_WIDTH
    svgEle.style.height = CANVAS_HEIGHT
    svgEle.style.position = "absolute"
    svgEle.style.top = '0px'
    svgEle.style.left = '0px'
    let polyPointListCanvas = []
    for (let i = 0; i < polygonPonitList.length; i++) {
        let newPoint = SVGMARK.coordinateImageToCanvas(translate, rotate, scale, IMAGE_WIDTH, IMAGE_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT, polygonPonitList[i])
        polyPointListCanvas.push(newPoint)
    }

    reflashSVG(svgEle, polyPointListCanvas)
    let canvas = document.getElementById("mainRender")
    let canvas_ctx = canvas.getContext('2d')
    canvas_ctx.fillStyle = 'rgba(22,255,255,0.3)'
    canvas_ctx.strokeStyle = 'rgba(22,255,255,1)'
    canvas_ctx.beginPath();
    canvas_ctx.moveTo(polyPointListCanvas[0].x, polyPointListCanvas[0].y)
    for (let i = 1; i < polyPointListCanvas.length; i++) {
        canvas_ctx.lineTo(polyPointListCanvas[i].x, polyPointListCanvas[i].y)
    }
    canvas_ctx.closePath();
    canvas_ctx.stroke();
    canvas_ctx.fill("evenodd")

    return polygonPonitList
}
function coordinateTrans(ele, e) {
    let points = { x: e.clientX, y: e.clientY }
    let vCanvasOrigin = ele.getBoundingClientRect();
    let tempX = parseInt(points.x - vCanvasOrigin.left);
    let tempY = parseInt(points.y - vCanvasOrigin.top);
    return {
        x: tempX,
        y: tempY
    };
}
function intRect(minRect, imageWidth, imageHeight) {
    minRect.top = Math.floor(minRect.top)
    if (minRect.top < 0) {
        minRect.top = 0;
    }
    minRect.left = Math.floor(minRect.left)
    if (minRect.left < 0) {
        minRect.left = 0;
    }
    minRect.right = Math.ceil(minRect.right)
    if (minRect.right > imageWidth - 1) {
        minRect.right = imageWidth - 1;
    }
    minRect.bottom = Math.ceil(minRect.bottom)
    if (minRect.bottom > imageHeight - 1) {
        minRect.bottom = imageHeight - 1;
    }
    return minRect
}
function getRangeOfList(imageWidth, imageHeight, orgList) {
    let range = { "top": imageHeight, "bottom": 0, "left": imageWidth, "right": 0 }
    for (let i = 0; i < orgList.length; i++) {
        let newPoint = orgList[i]
        if (newPoint.x < range.left) {
            range.left = newPoint.x
        }
        if (newPoint.y < range.top) {
            range.top = newPoint.y
        }
        if (newPoint.x > range.right) {
            range.right = newPoint.x
        }
        if (newPoint.y > range.bottom) {
            range.bottom = newPoint.y
        }
    }
    range = intRect(range)

    return range
}

function getPolyMarkInfo(orgdataObj, polyList) {
    console.time('getPolyMarkInfo')
    let { width: imageWidth, height: imageHeight, data: buf } = orgdataObj
    let valueList = [], max = null, min = null, dataLength = 0, count = 0, aver = 0, variance = 0
    let range = getRangeOfList(imageWidth, imageHeight, polyList)
    console.log(range)
    for (let j = range.top; j < range.bottom; j++) {
        for (let i = range.left; i < range.right; i++) {
            let point = { x: i, y: j }
            if (SVGMARK.rayCastingWithEvenodd(point, polyList)) {
                let pos = j * imageWidth + i;
                let B = buf[pos]
                valueList.push(B)
                if (max == null) {
                    max = B;
                } else if (B > max) {
                    max = B;
                }
                if (min == null) {
                    min = B;
                } else if (B < min) {
                    min = B;
                }
                dataLength = dataLength + B;
                count++;
            }
        }
    }
    aver = dataLength / count;
    for (let i = 0; i < valueList.length; i++) {
        variance = variance + (valueList[i] - aver) * (valueList[i] - aver);
    }
    variance = Math.sqrt(variance / count);
    let infoObj = { min, max, aver, variance, count, markLength: polyList.length }
    console.timeEnd('getPolyMarkInfo')
    return infoObj
}

function transListBypoint(point, pointList) {
    let minDis = IMAGE_WIDTH * IMAGE_HEIGHT * IMAGE_WIDTH * IMAGE_HEIGHT
    //找到最近的点
    let indexNow = 0
    for (let i = 0; i < pointList.length; i++) {
        let dis = Math.sqrt(Math.pow((pointList[i].x - point.x), 2) + Math.pow((pointList[i].y - point.y), 2))
        if (dis < minDis) {
            minDis = dis
            indexNow = i
        }
    }
    //如果最近的点就是最后有一个点，直接返回
    if (indexNow > pointList.length - 2) {
        return pointList
    }
    //轮转数组让index处变到末尾
    let newPointList = []
    for (let i = 0; i < pointList.length; i++) {
        let newindex = i + indexNow + 1
        if (newindex >= pointList.length) {
            newindex = newindex - pointList.length
        }
        newPointList[i] = pointList[newindex]
    }
    return newPointList
}



//程序从这里运行
let _testMark, _testRange
//五角星
// _testMark = [{ x: 200, y: 110 }, { x: 140, y: 298 }, { x: 290, y: 178 }, { x: 110, y: 178 }, { x: 260, y: 298 }, { x: 200, y: 110 }]
//另一个测试路径
_testMark = [{ x: 130, y: 190 }, { x: 210, y: 120 }, { x: 340, y: 230 }, { x: 160, y: 230 }, { x: 290, y: 120 }, { x: 370, y: 190 }]


let _scale = { x: 0.5, y: 0.5 }, _translate = { x: 10, y: 10 }, _rotate = 1
let orgdataObj = IMTA.create16BitData(IMAGE_WIDTH, IMAGE_HEIGHT, 0, 2000)
//渲染原始图像
let orgImageCanvas = CIMG.getRenderCImg(orgdataObj, "B&W", 2000, 1000)
let imgContent = document.getElementById('image')
imgContent.style.width = IMAGE_WIDTH.toString() + 'px'
imgContent.style.height = IMAGE_HEIGHT.toString() + 'px'
RENADER.renderImage("imageRender", orgImageCanvas, { x: 1, y: 1 }, 0, { x: 0, y: 0 }, IMAGE_WIDTH, IMAGE_HEIGHT)
//渲染模拟render
let curImageCanvas = CIMG.getRenderCImg(orgdataObj, "B&W", 2000, 1000)
let rendeContent = document.getElementById('render')
rendeContent.style.width = CANVAS_WIDTH.toString() + 'px'
rendeContent.style.height = CANVAS_HEIGHT.toString() + 'px'
RENADER.renderImage("mainRender", curImageCanvas, _scale, _rotate, _translate, CANVAS_WIDTH, CANVAS_HEIGHT)

setSVGMark(_testMark)
drawSVGMark(_testMark, _scale, _rotate, _translate)
let catcher = document.getElementById('image')
catcher.addEventListener('mousedown', e => {
    let clickPoint = coordinateTrans(catcher, e)
    let flag = SVGMARK.rayCastingWithEvenodd(clickPoint, _testMark)
    let infoObj = getPolyMarkInfo(orgdataObj, _testMark)
    console.log(JSON.stringify(infoObj))
    let infoshow = document.getElementById('info')
    infoshow.innerHTML = `click:" ${JSON.stringify(clickPoint)} ifIn:${flag} \n\n ${JSON.stringify(infoObj)}`

    _testMark = transListBypoint(clickPoint, _testMark)
})
catcher.addEventListener('mouseup', e => {
    let infoshow = document.getElementById('info')
    infoshow.innerHTML = ""
})