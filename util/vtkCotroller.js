/*
 * @Author: 
 * @Date: 2023-09-11 16:56:06
 * @LastEditTime: 2023-09-11 17:06:23
 * @LastEditors: ssy
 * @Description: 
 */
class vtkControllerClass{
    constructor(dom,fullScreenRenderer,vtk){
        this.MainDom = dom
        this.fullScreenRenderer = fullScreenRenderer
        this.vtk = vtk
        this.renderWindow = fullScreenRenderer.getRenderWindow()
        MainDom.addEventListener('mousedown', e=>{
            this.onMouseDown(e)
        } )
        MainDom.addEventListener('mousemove', e=>{
            this.onMouseMove(e)
        } )
        MainDom.addEventListener('mouseup', e=>{
            this.onMouseUp(e)
        } )
    }

    onMouseDown(e){

    }

    onMouseMove(e){

    }

    onMouseUp(e){

    }

    
}   

export default vtkControllerClass