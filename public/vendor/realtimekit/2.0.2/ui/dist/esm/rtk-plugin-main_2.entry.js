import { r as registerInstance, h, a as Host, g as getElement, d as createEvent } from './index-gJCRRBX0.js';
import { e as defaultIconPack, i as useLanguage, c as createDefaultConfig } from './ui-store-CkvSNsmd.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';
import { f as formatName, a as shorten } from './string-vBD2htwQ.js';

const rtkPluginMainCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{display:flex;height:100%;width:100%;flex-direction:column;overflow:hidden;border-radius:var(--rtk-border-radius-lg, 12px);color:rgb(var(--rtk-colors-text-1000, 255 255 255))}header{display:flex;height:var(--rtk-space-8, 32px);align-items:center;justify-content:space-between;padding-left:var(--rtk-space-3, 12px);padding-right:var(--rtk-space-3, 12px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-900, 26 26 26) / var(--tw-bg-opacity))}header>div{display:flex;align-items:center}rtk-button{display:flex;height:var(--rtk-space-5, 20px);width:var(--rtk-space-5, 20px);flex-direction:column;align-items:center;border-radius:9999px}rtk-button rtk-icon{height:var(--rtk-space-3, 12px);width:var(--rtk-space-3, 12px)}.view-container{position:relative;height:100%;width:100%;overflow:hidden;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-video-bg, 24 24 24) / var(--tw-bg-opacity))}.view-container ::slotted(*){width:100%;height:100%;display:block}`;

var __decorate$1 = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const RtkPluginMain = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.canDeactivatePlugin = false;
    }
    connectedCallback() {
        this.pluginChanged(this.plugin);
    }
    pluginChanged(plugin) {
        var _a, _b;
        if (plugin == null)
            return;
        this.canDeactivatePlugin = (_b = (_a = plugin.permissions) === null || _a === void 0 ? void 0 : _a.canDeactivate) !== null && _b !== void 0 ? _b : false;
        this.attachView(plugin);
    }
    attachView(plugin) {
        const component = plugin.component;
        if (!(component instanceof HTMLElement))
            return;
        // Avoid unnecessary DOM churn if the same element is already mounted
        if (this.host.firstElementChild === component)
            return;
        // Clear any existing light DOM children
        while (this.host.firstChild) {
            this.host.removeChild(this.host.firstChild);
        }
        // Place in light DOM — the <slot> projects it into the shadow DOM layout
        this.host.appendChild(component);
    }
    disconnectedCallback() {
        while (this.host.firstChild) {
            this.host.removeChild(this.host.firstChild);
        }
    }
    render() {
        if (this.plugin == null)
            return null;
        return (h(Host, null, h("header", { part: "header" }, h("div", null, this.plugin.name), this.canDeactivatePlugin && (h("div", null, h("rtk-button", { kind: "icon", onClick: () => this.plugin.deactivate(), part: "button" }, h("rtk-icon", { icon: this.iconPack.dismiss }))))), h("div", { class: "view-container" }, h("slot", null))));
    }
    get host() { return getElement(this); }
    static get watchers() { return {
        "plugin": [{
                "pluginChanged": 0
            }]
    }; }
};
__decorate$1([
    SyncWithStore()
], RtkPluginMain.prototype, "meeting", void 0);
__decorate$1([
    SyncWithStore()
], RtkPluginMain.prototype, "iconPack", void 0);
__decorate$1([
    SyncWithStore()
], RtkPluginMain.prototype, "t", void 0);
RtkPluginMain.style = rtkPluginMainCss();

const rtkTabBarCss = () => `.scrollbar{scrollbar-width:thin;scrollbar-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))     var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar{height:var(--rtk-space-1\\.5, 6px);width:var(--rtk-space-1\\.5, 6px);border-radius:9999px;background-color:var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar-thumb{border-radius:9999px;background-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))}:host{box-sizing:border-box;display:flex;height:100%;width:var(--rtk-space-16, 64px);flex-direction:column;gap:var(--rtk-space-2, 8px);overflow-y:auto;font-family:var(--rtk-font-family, sans-serif)}rtk-button{z-index:10}.col{display:flex;flex-direction:column;align-items:center}.tab{display:flex;height:var(--rtk-space-16, 64px);width:var(--rtk-space-16, 64px);align-items:center;justify-content:center;margin-bottom:var(--rtk-space-2, 8px);font-size:12px;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity))}.tab.active{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / var(--tw-bg-opacity))}.tab img{height:var(--rtk-space-7, 28px);width:var(--rtk-space-7, 28px);border-radius:var(--rtk-border-radius-sm, 4px)}.tab .name{margin-top:var(--rtk-space-0\\.5, 2px)}:host([size='sm']){flex-direction:column;margin-top:var(--rtk-space-4, 16px);height:var(--rtk-space-16, 64px);width:100%;flex-direction:row;gap:var(--rtk-space-2, 8px);overflow-x:auto}:host([size='sm']) .tab{margin:var(--rtk-space-0, 0px);text-overflow:clip;min-width:100px;height:40px}:host([size='sm']) .tab .col{display:flex;flex-direction:row;align-items:center;gap:var(--rtk-space-2, 8px)}:host([size='sm']) .tab .col img,:host([size='sm']) .tab .col rtk-icon{height:var(--rtk-space-6, 24px);width:var(--rtk-space-6, 24px)}:host([size='sm']) .tab .col .name{gap:var(--rtk-space-1, 4px)}:host([layout='column']){flex-direction:column}:host([layout='column']) .aside{flex:2;max-width:100%;width:100%}@media (orientation: portrait){:host([size='sm']){margin-top:var(--rtk-space-2, 8px);height:var(--rtk-space-16, 64px);width:100%;flex-direction:row;transition:all 0.3s linear}:host([size='md']){height:var(--rtk-space-24, 96px);width:100%;flex-direction:row;transition:all 0.3s linear}:host .tab{margin:var(--rtk-space-0, 0px)}}@media (orientation: landscape){:host([size='sm']){margin-right:var(--rtk-space-4, 16px);height:100%;width:var(--rtk-space-14, 56px);flex-direction:row;gap:var(--rtk-space-2, 8px);overflow-y:auto;overflow-x:hidden;transition:all 0.3s linear}:host([size='md']){margin-right:var(--rtk-space-4, 16px);height:100%;width:var(--rtk-space-14, 56px);flex-direction:row;gap:var(--rtk-space-2, 8px);overflow-y:auto;overflow-x:hidden;transition:all 0.3s linear}:host .tab{margin:var(--rtk-space-0, 0px)}:host([size='sm']) .tab{margin:var(--rtk-space-0, 0px);width:100%;text-overflow:clip;min-width:0px;min-height:40px}:host([size='sm']) .tab .col{display:flex;flex-direction:column;align-items:center;gap:var(--rtk-space-2, 8px);font-size:10px}:host([size='sm']) .tab .col img,:host([size='sm']) .tab .col rtk-icon{height:var(--rtk-space-3, 12px);width:var(--rtk-space-3, 12px)}:host([size='sm']) .tab .col .name{gap:var(--rtk-space-1, 4px)}}`;

var __decorate = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const RtkTabBar = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.tabChange = createEvent(this, "tabChange", 7);
        /** UI Config */
        this.config = createDefaultConfig();
        /** Grid Layout */
        this.layout = 'row';
        /** Icon Pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        /** Tabs */
        this.tabs = [];
    }
    render() {
        return (h(Host, { key: '1c4bce26c4c5baa19cd89be862922267c408ab97' }, h("rtk-spotlight-indicator", { key: '496f3634771c4b9c94ff64e23fa5695e2e1532e2', meeting: this.meeting, iconPack: this.iconPack, t: this.t, size: this.size }), this.tabs.map((tab) => {
            var _a, _b, _c, _d, _e;
            let isActive = false;
            if (((_a = this.activeTab) === null || _a === void 0 ? void 0 : _a.type) === 'plugin' &&
                tab.plugin &&
                ((_b = this.activeTab) === null || _b === void 0 ? void 0 : _b.plugin.id) === tab.plugin.id)
                isActive = true;
            else if (((_c = this.activeTab) === null || _c === void 0 ? void 0 : _c.type) === 'screenshare' &&
                tab.participant &&
                ((_d = this.activeTab) === null || _d === void 0 ? void 0 : _d.participant.id) === tab.participant.id)
                isActive = true;
            if (tab.type === 'screenshare') {
                const participant = tab.participant;
                const name = formatName(participant.name);
                return (h("rtk-button", { title: `${name}'s Screen Share`, key: tab.participant.id, kind: "icon", variant: isActive ? 'primary' : 'secondary', class: {
                        tab: true,
                        active: isActive,
                    }, onClick: () => this.tabChange.emit(tab) }, h("div", { class: "center col" }, h("rtk-icon", { icon: this.iconPack.share_screen_person }), h("span", { class: "name" }, participant.id === ((_e = this.meeting) === null || _e === void 0 ? void 0 : _e.self.id) ? this.t('you') : shorten(name, 6)))));
            }
            else if (tab.type === 'plugin') {
                const plugin = tab.plugin;
                return (h("rtk-button", { title: plugin.name, key: plugin.id, kind: "icon", variant: isActive ? 'primary' : 'secondary', class: {
                        tab: true,
                        active: isActive,
                    }, onClick: () => this.tabChange.emit(tab) }, h("div", { class: "center col" }, h("img", { src: plugin.icon, alt: plugin.name }), h("span", { class: "name" }, shorten(plugin.name, 6)))));
            }
        })));
    }
};
__decorate([
    SyncWithStore()
], RtkTabBar.prototype, "meeting", void 0);
__decorate([
    SyncWithStore()
], RtkTabBar.prototype, "states", void 0);
__decorate([
    SyncWithStore()
], RtkTabBar.prototype, "config", void 0);
__decorate([
    SyncWithStore()
], RtkTabBar.prototype, "iconPack", void 0);
__decorate([
    SyncWithStore()
], RtkTabBar.prototype, "t", void 0);
RtkTabBar.style = rtkTabBarCss();

export { RtkPluginMain as rtk_plugin_main, RtkTabBar as rtk_tab_bar };
