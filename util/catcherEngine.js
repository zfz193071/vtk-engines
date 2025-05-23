/*
 * @Author: 
 * @Date: 2023-11-23 12:08:56
 * @LastEditTime: 2023-12-01 21:50:11
 * @LastEditors: ssy
 * @Description: 
 */
class CatcherEngine {
    constructor(catcherDom) {
        this.#catcherDom = catcherDom
        //绑定鼠标事件
        this.#catcherDom.addEventListener('mousedown', this.#mouseDown)
        this.#catcherDom.addEventListener('mousemove', this.#mouseMove)
        this.#catcherDom.addEventListener('mouseup', this.#mouseUp)
        this.#catcherDom.addEventListener('mouseleave', this.#mouseLeave)
        //绑定滚轮事件
        this.#catcherDom.addEventListener('wheel', this.#mouseWheel)
    }
    #catcherDom = null
    #OptSelected = null   //PAN,ZOOM,WWWL,ROTATE,ACROSS
    #startPos = null
    #lastPos = null
    #curPos = null
    #GPARA = null
    #curViewMod = null
    #renderEngine = null

    #mouseDown = (e) => {
        this.#startPos = this.eventToCanvasPos(e)
        this.#curPos = { ...this.#startPos }
        console.log('mousedown', JSON.stringify(this.#startPos))
        this.handClickOpt()
        this.handleMoveOpt()
    }
    #mouseMove = (e) => {
        this.#curPos = this.eventToCanvasPos(e)
        this.handFindOpt()
        if (this.#startPos) {
            if (this.#curPos) {
                this.#lastPos = { ...this.#curPos }
            }
            this.#curPos = this.eventToCanvasPos(e)
            this.handleMoveOpt()
        }
    }
    #mouseUp = (e) => {
        console.log('mouseup')
        this.#startPos = null
        this.#curPos = this.eventToCanvasPos(e)
        this.#lastPos = null
        this.handEndOpt()
    }
    #mouseLeave = (e) => {
        console.log('mouseout')
        this.#startPos = null
        this.#curPos = this.eventToCanvasPos(e)
        this.#lastPos = null
        this.handEndOpt()
    }
    #mouseWheel = (e) => {
        console.log('mousewheel')
    }

    eventToCanvasPos = (e) => {
        let canvasPos = {
            x: e.offsetX,
            y: e.offsetY
        }
        return canvasPos
    }
    getCatrcherDom = () => {
        return this.#catcherDom
    }

    setCurOpt = (opt) => {
        this.#OptSelected = opt
    }

    setCurViewMod (curViewMod) {
        this.#curViewMod = curViewMod
    }

    setGPARA (GPARA) {
        this.#GPARA = GPARA
    }
    setRender (renderEngine) {
        this.#renderEngine = renderEngine
    }
    handFindOpt () {
        if (this.#OptSelected === "ACROSS") {
            this.handleFindCross(this.#curPos)
        }
    }
    handClickOpt () {
        if (this.#OptSelected === "ACROSS") {
            this.handleSetCross(this.#curPos, "start")
        }
    }
    handleMoveOpt () {
        switch (this.#OptSelected) {
            case "ZOOM":
                this.handleZoom()
                break
            case "WWWL":
                this.handleWWWL()
                break
            case "ROTATE":
                this.handleRotate()
                break
            case "ACROSS":
                this.handleSetCross(this.#curPos, "move")
                break
            default:
                break
        }
    }
    handEndOpt () {
        if (this.#OptSelected === "ACROSS") {
            this.handleSetCross(this.#curPos, "end")
        }
    }
    handleZoom () {
        let { x, y } = this.#curPos
        let { x: x0, y: y0 } = this.#lastPos
        let temp = this.#GPARA
        console.log('zoom before', JSON.stringify(temp.scale))
        let zoomFactor = Math.exp((y0 - y) * Math.log(1.005))
        temp.scale = temp.scale * zoomFactor
        this.#GPARA.value = { ...temp }
        console.log('zoom after', JSON.stringify(this.#GPARA.scale))
    }
    handleFindCross (pos) {
        this.#renderEngine.drawNewCrossOn3d(pos)
    }
    handleSetCross (pos, flag) {
        const isChecked = document.getElementById('ORTHO_MODE').checked;
        this.#renderEngine.setCrossFromCatcher(pos, flag, isChecked)
    }
}

export default CatcherEngine