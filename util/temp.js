setCrossFromCatcher(pos, flag, isOrthogonalMode) {
  if (flag === "start") {
    if (this.#circleChoosed) {
      this.#crossRotateStart = pos;
      this.#crossMoveStart = false;
      this.#crossThickStart = false;
    } else if (this.#rectChoosed) {
      if (isOrthogonalMode) {
        // 正交模式：拖动一条线时，另一条线保持垂直
        // 假设 pos 是拖动的位置，我们需要更新十字线的位置
        // 这里假设十字线的位置存储在 #crossPos 中
        if (this.#isHorizontalDrag) {
          // 水平拖动，更新水平位置
          this.#crossPos.x = pos.x;
          // 垂直位置保持垂直，根据当前垂直位置更新
          this.#crossPos.y = this.#getOrthogonalYPosition();
        } else {
          // 垂直拖动，更新垂直位置
          this.#crossPos.y = pos.y;
          // 水平位置保持垂直，根据当前水平位置更新
          this.#crossPos.x = this.#getOrthogonalXPosition();
        }
      } else {
        // 非正交模式：拖动一条线时，另一条线保持不动
        if (this.#isHorizontalDrag) {
          // 水平拖动，只更新水平位置
          this.#crossPos.x = pos.x;
        } else {
          // 垂直拖动，只更新垂直位置
          this.#crossPos.y = pos.y;
        }
      }
      this.#crossMoveStart = pos;
      this.#crossThickStart = false;
      this.#crossRotateStart = false;
    }
  } else if (flag === "move") {
    if (this.#crossMoveStart) {
      if (isOrthogonalMode) {
        // 正交模式：拖动一条线时，另一条线保持垂直
        if (this.#isHorizontalDrag) {
          // 水平拖动，更新水平位置
          this.#crossPos.x = this.#crossMoveStart.x + (pos.x - this.#crossMoveStart.x);
          // 垂直位置保持垂直，根据当前垂直位置更新
          this.#crossPos.y = this.#getOrthogonalYPosition();
        } else {
          // 垂直拖动，更新垂直位置
          this.#crossPos.y = this.#crossMoveStart.y + (pos.y - this.#crossMoveStart.y);
          // 水平位置保持垂直，根据当前水平位置更新
          this.#crossPos.x = this.#getOrthogonalXPosition();
        }
      } else {
        // 非正交模式：拖动一条线时，另一条线保持不动
        if (this.#isHorizontalDrag) {
          // 水平拖动，只更新水平位置
          this.#crossPos.x = this.#crossMoveStart.x + (pos.x - this.#crossMoveStart.x);
        } else {
          // 垂直拖动，只更新垂直位置
          this.#crossPos.y = this.#crossMoveStart.y + (pos.y - this.#crossMoveStart.y);
        }
      }
      // 更新裁剪平面
      this.setCross([this.#crossPos.x, this.#crossPos.y, 0], [this.#thickness, this.#thickness, this.#thickness], [0, 0, 0]);
    } else if (this.#crossThickStart) {
      // 处理厚度拖动逻辑
    } else if (this.#crossRotateStart) {
      // 处理旋转拖动逻辑
    }
  } else if (flag === "end") {
    this.#crossMoveStart = false;
    this.#crossThickStart = false;
    this.#crossRotateStart = false;
  }
}

// 辅助方法：获取正交模式下的水平位置
#getOrthogonalXPosition() {
  // 这里需要根据具体的正交逻辑实现
  // 假设十字线的垂直位置和当前裁剪平面的信息来计算
  return this.#crossPos.x;
}

// 辅助方法：获取正交模式下的垂直位置
#getOrthogonalYPosition() {
  // 这里需要根据具体的正交逻辑实现
  // 假设十字线的水平位置和当前裁剪平面的信息来计算
  return this.#crossPos.y;
}