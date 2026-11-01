// 全局应用上下文（由 app.js 初始化，视图通过它读写数据）
export const app = {
  data: null,
  prefs: null,
  /** 修改数据并保存、重新渲染：app.update(d => { d.name = 'x' }) */
  update: null,
  render: null,
  navigate: null,
  /** PWA 的访问地址（用于书签脚本、小组件跳转） */
  baseUrl: ''
};
