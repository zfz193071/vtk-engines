/*
 * @Author: 
 * @Date: 2023-09-11 15:44:31
 * @LastEditTime: 2024-01-08 12:55:40
 * @LastEditors: ssy
 * @Description: 这段代码定义了一个 VtkVolumeActorClass 类，用于创建 VTK 体积渲染的 actor。该类接受初始化参数，
 * 包括体积数据、窗宽窗位、颜色映射等，并提供了一些方法用于处理体积数据、初始化属性和设置窗宽窗位
 */
import COLORMAP from './colormap.js'
// 从 glMatrix 库中解构出 mat4 对象，用于处理 4x4 矩阵，常用于图形变换
const { mat4 } = glMatrix
// 创建 VTK 体积渲染的 actor
class VtkVolumeActorClass {
  // para 是一个包含初始化参数的对象，vtk 是 VTK 库的引用
  constructor(para, vtk) {
    const { name, dataType, initVolumeBuf, size, origin, pixcelSpacing, BlendMode, ww, wl, colormapIndex, opacity } = para
    // console.log(name,dataType,size,origin,pixcelSpacing,BlendMode,ww, wl, colormapIndex, opacity)
    // 创建一个新的 vtkDataArray 实例，用于存储体积数据
    const Scalars = vtk.Common.Core.vtkDataArray.newInstance({
      size: size[0] * size[1] * size[2],
      dataType: dataType,
      name: name,
    })
    // 将初始化的体积数据缓冲区 initVolumeBuf 设置到 Scalars 中
    Scalars.setData(initVolumeBuf, 1)
    // 创建一个新的 vtkImageData 实例，用于表示体积图像数据
    let initVolume = vtk.Common.DataModel.vtkImageData.newInstance()
    // 设置体积数据的原点
    initVolume.setOrigin(origin)
    // 设置体积数据的像素间距
    initVolume.setSpacing(pixcelSpacing[0], pixcelSpacing[1], pixcelSpacing[2])
    // 设置体积数据的范围
    initVolume.setExtent(0, size[0] - 1, 0, size[1] - 1, 0, size[2] - 1)
    // 将 Scalars 数据设置到 initVolume 的点数据中
    initVolume.getPointData().setScalars(Scalars)
    const ifReverce = false
    // 定义一个布尔变量 ifReverce，用于控制是否反转体积数据
    if (ifReverce) {
      //反转，得到头上脚下的数据
      console.time("reverce to get patientVolume")
      console.log("翻转前 origin", initVolume.getOrigin())
      // 创建一个新的 vtkImageReslice 实例，用于图像重采样和变换
      const imageReverce = vtk.Imaging.Core.vtkImageReslice.newInstance();
      // 将 initVolume 设置为 imageReverce 的输入数据
      imageReverce.setInputData(initVolume);
      // 创建一个单位矩阵
      const axes = mat4.identity(new Float64Array(16));
      // 绕 Y 轴旋转 180 度
      mat4.rotateY(axes, axes, Math.PI);
      // 设置 imageReverce 的重采样轴
      imageReverce.setResliceAxes(axes)
      // 设置插值模式为线性插值
      imageReverce.setInterpolationMode("Linear")
      // 添加 setKeepOrthogonality 配置
      // imageReverce.setKeepOrthogonality(false);
      // 获取反转后的体积数据
      initVolume = imageReverce.getOutputData()

      console.timeEnd("reverce to get patientVolume")
      console.log("翻转后 origin", initVolume.getOrigin())
    }
    let patientVolume = initVolume
    // 定义一个布尔变量 ifReslice，用于控制是否重采样体积数据
    const ifReslice = false
    if (ifReslice) {
      //重采样+旋转，得到Patient坐标系下同分辨率的数据，目前暂时不考虑旋转
      console.time("reslice to get patientVolume")
      // 创建一个新的 vtkImageReslice 实例，用于图像重采样和变换
      const imageReslice = vtk.Imaging.Core.vtkImageReslice.newInstance();
      // 将 initVolume 设置为 imageReslice 的输入数据
      imageReslice.setInputData(initVolume);
      imageReslice.setInterpolationMode("Linear")
      // 调用 getSamlePara 方法获取重采样的参数
      let { curSize, curSpacing } = this.getSamlePara(size, pixcelSpacing)
      // 设置重采样后的输出像素间距
      imageReslice.setOutputSpacing(curSpacing[0], curSpacing[1], curSpacing[2])
      // 设置重采样后的输出范围
      imageReslice.setOutputExtent(0, curSize[0] - 1, 0, curSize[1] - 1, 0, curSize[2] - 1)
      // imageReverce.setKeepOrthogonality(false);
      // 获取重采样后的体积数据
      patientVolume = imageReslice.getOutputData()
      console.timeEnd("reslice to get patientVolume")
    }
    // 创建一个新的 vtkVolumeMapper 实例，用于将体积数据映射到屏幕上
    const Mapper = vtk.Rendering.Core.vtkVolumeMapper.newInstance()
    Mapper.setInputData(patientVolume)
    // 设置射线采样距离
    Mapper.setSampleDistance((Math.min(pixcelSpacing[0], pixcelSpacing[1], pixcelSpacing[2])) / 2)
    // 设置每条射线的最大采样数
    Mapper.setMaximumSamplesPerRay(4000);
    // 设置是否优先考虑渲染速度而不是精度
    Mapper.setPreferSizeOverAccuracy(true);
    Mapper.setBlendMode(BlendMode);

    // 创建一个新的 vtkVolume 实例，用于表示体积 actor
    const Actor = vtk.Rendering.Core.vtkVolume.newInstance()
    // 将 Mapper 设置为 Actor 的映射器
    Actor.setMapper(Mapper)
    // 调用 initProps 方法初始化 Actor 的属性
    this.initProps(Actor.getProperty(), ww, wl, colormapIndex, opacity, vtk);

    // 将创建的对象赋值给类的属性
    this.Actor = Actor
    this.Mapper = Mapper
    this.initVolume = initVolume
    this.patientVolume = patientVolume
    this.Scalars = Scalars
    this.renderWindow = null
  }
  // 该方法用于计算重采样的参数
  getSamlePara (orgSize, orgSpacing) {
    // 定义最大边长为 300
    const MAXSIZE = 300
    // 计算世界坐标下的尺寸
    let worldSize = orgSize.map((item, index) => item * orgSpacing[index])
    // 获取最小像素间距
    let minSpcing = Math.min(...orgSpacing)
    // 计算临时尺寸
    let tempSize = worldSize.map(item => item / minSpcing)
    // 获取当前最大边长
    let maxSizeNow = Math.max(...tempSize)
    // 如果当前最大边长小于 300，则直接以最小分辨率重采样
    if (maxSizeNow < MAXSIZE) {
      //可以直接以当前的最小分辨率重采样
      return {
        curSize: tempSize,
        curSpacing: [minSpcing, minSpcing, minSpcing]
      }
    } else {
      // 计算缩放比例并调整尺寸和像素间距
      //保证最大边长只有512
      let scale = maxSizeNow / MAXSIZE
      return {
        curSize: tempSize.map(item => Math.round(item / scale)),
        curSpacing: [minSpcing * scale, minSpcing * scale, minSpcing * scale]
      }
    }
  }
  // 该方法用于初始化 Actor 的属性
  initProps (property, ww, wl, colormapIndex, opacity, vtk) {
    // 设置 RGB 传输函数
    property.setRGBTransferFunction(0, this.newColorFunction(ww, wl, colormapIndex, vtk));
    // 设置标量不透明度函数
    property.setScalarOpacity(0, this.newOpacityFunction(ww, wl, opacity, vtk));
    // property.setInterpolationTypeToLinear();
    // 设置插值类型为快速线性插值
    property.setInterpolationTypeToFastLinear();
    // 启用阴影效果
    property.setShade(true);
    //这个参数不能随便设置，会导致渲染的数据出现黑色的噪点
    // 设置标量不透明度单位距离
    property.setScalarOpacityUnitDistance(0, 4.5);
    // 启用梯度不透明度
    property.setUseGradientOpacity(0, true);
    // 设置梯度不透明度的最小值、最大值和最小不透明度、最大不透明度
    property.setGradientOpacityMinimumValue(0, 0, 1);
    property.setGradientOpacityMinimumOpacity(0, 0.0);
    property.setGradientOpacityMaximumValue(0, 1);
    property.setGradientOpacityMaximumOpacity(0, 1.0);
    // 设置环境光、漫反射光、镜面反射光和镜面反射光强度
    property.setAmbient(0.2);
    property.setDiffuse(0.7);
    property.setSpecular(0.3);
    property.setSpecularPower(8.0);
  }
  // 该方法用于创建颜色传输函数
  newColorFunction (ww, wl, colormapIndex, vtk) {
    // 根据颜色映射索引获取颜色映射数组
    let _COLOR = COLORMAP[colormapIndex]
    // 创建一个新的 vtkColorTransferFunction 实例
    let fun = vtk.Rendering.Core.vtkColorTransferFunction.newInstance();
    // 计算窗宽窗位的上下限
    let bottom = wl - ww / 2
    let top = wl + ww / 2
    // 如果颜色映射索引为 "B&W"，则添加黑白颜色段
    if (colormapIndex === "B&W") {
      fun.addRGBSegment(bottom, 0, 0, 0, top, 1.0, 1.0, 1.0);
    } else {
      // 否则，根据颜色映射数组添加 RGB 点
      for (let i = 0; i < 256; i++) {
        let value = (i - 0) / 256 * (top - bottom) + bottom
        let r = _COLOR[i][0] / 255
        let g = _COLOR[i][1] / 255
        let b = _COLOR[i][2] / 255

        fun.addRGBPoint(value, r, g, b);
      }
    }
    return fun;
  }
  // 该方法用于创建不透明度函数
  newOpacityFunction (ww, wl, opacity, vtk) {
    // 计算窗宽窗位的上下限
    let bottom = wl - ww / 2
    let top = wl + ww / 2
    // 创建一个新的 vtkPiecewiseFunction 实例
    var fun = vtk.Common.DataModel.vtkPiecewiseFunction.newInstance();
    // 在上下限处添加不透明度点
    fun.addPoint(bottom, opacity);
    fun.addPoint(top, opacity);
    return fun;
  }
  // 该方法用于设置窗宽窗位和颜色映射
  setWWWL (ww, wl, colormapIndex) {
    // 获取 Actor 的属性
    const property = this.Actor.getProperty();
    // 设置 RGB 传输函数
    property.setRGBTransferFunction(0, this.newColorFunction(ww, wl, colormapIndex, vtk));
    // 设置标量不透明度函数
    property.setScalarOpacity(0, this.newOpacityFunction(ww, wl, 1, vtk));
  }
}

export default VtkVolumeActorClass