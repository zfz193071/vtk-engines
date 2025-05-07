1. 创建了 4 个视图窗口（3 个 2D、1 个 3D）；

2. 对每个窗口进行了设置（颜色、相机、样式等）；

3. 绑定了 Reslice Cursor Widget 到 2D 视图中，显示为交叉的线条，可操作；

4. 给 3D 视图添加了 Annotated Cube 和方向控件，用来辅助观察方向；

5. 初始化了与图像重采样相关的管线（reslice + mapper + actor）；

6. 提前创建了 debug 用的小球，用于辅助调试切面在三维中的位置。

7. 加载数据；

然后绑定到 Widget；

计算中心点；

控制 Reslice Cursor 的切面位置。
