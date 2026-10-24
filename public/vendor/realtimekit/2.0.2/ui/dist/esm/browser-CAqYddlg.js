const isFirefox = (meeting) => { var _a; return (_a = meeting === null || meeting === void 0 ? void 0 : meeting.__internals__) === null || _a === void 0 ? void 0 : _a.browserSpecs.isFirefox(); };

export { isFirefox as i };
