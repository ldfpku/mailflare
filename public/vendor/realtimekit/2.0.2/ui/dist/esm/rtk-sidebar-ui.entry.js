import { r as registerInstance, d as createEvent, h, a as Host } from './index-gJCRRBX0.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';
import './breakout-rooms-manager-B1Qky9zO.js';
import './livestream-C0vp-Q7v.js';
import { e as defaultIconPack, i as useLanguage } from './ui-store-CkvSNsmd.js';
import './breakout-rooms-Daj_55_i.js';

const rtkSidebarUiCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{position:relative;height:100%;width:100%;font-family:var(--rtk-font-family, sans-serif);z-index:50;display:flex;flex-direction:column;container-type:size;container-name:sidebarui}@container sidebarui (height < 370px){.main-header{height:var(--rtk-space-8, 32px) !important}.close{top:var(--rtk-space-0\\.5, 2px) !important;left:var(--rtk-space-0, 0px) !important;color:rgba(var(--rtk-colors-danger, 255 45 45) / 0.6)}}:host([view='sidebar']){--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-900, 26 26 26) / var(--tw-bg-opacity))}:host([view='full-screen']){position:absolute;top:var(--rtk-space-0, 0px);right:var(--rtk-space-0, 0px);bottom:var(--rtk-space-0, 0px);left:var(--rtk-space-0, 0px);max-width:100%;border:none}::slotted(*){flex-grow:1}.close{position:absolute;top:var(--rtk-space-2, 8px);left:var(--rtk-space-2, 8px);z-index:10}.main-header{position:relative;display:flex;height:var(--rtk-space-12, 48px);place-items:center;justify-content:center}.main-header,.mobile-tabs{flex-shrink:0}.mobile-tabs{display:flex;place-items:center;justify-content:space-evenly;border-bottom:1px solid rgb(var(--rtk-colors-background-700, 44 44 44))}.mobile-tabs button{margin:var(--rtk-space-0, 0px);border-width:var(--rtk-border-width-none, 0);border-style:none;background-color:transparent;padding:var(--rtk-space-0, 0px);color:rgb(var(--rtk-colors-text-600, 255 255 255 / 0.52));height:var(--rtk-space-10, 40px);cursor:pointer;padding-left:var(--rtk-space-4, 16px);padding-right:var(--rtk-space-4, 16px);font-weight:500;border-bottom:1px solid transparent}.mobile-tabs button.active{--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-brand-300, 73 124 253) / var(--tw-border-opacity));--tw-text-opacity:1;color:rgba(var(--rtk-colors-brand-300, 73 124 253) / var(--tw-text-opacity))}header h3{font-size:14px;font-weight:500}@media only screen and (max-device-height: 480px) and (orientation: landscape){.main-header{display:none !important}}.tab-participant-count-badge{display:inline-block;padding:2px 5px;border-radius:9999px;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / var(--tw-bg-opacity));font-size:12px;color:rgb(var(--rtk-colors-text-700, 255 255 255 / 0.64))}.tab-participant-count-badge:not(.selected-tab){--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity))}.tab-participant-count-badge.requests-pending{background-color:rgba(var(--rtk-colors-danger))}`;

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
const RtkSidebarUi = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.tabChange = createEvent(this, "tabChange", 7);
        this.sidebarClose = createEvent(this, "sidebarClose", 7);
        /** View */
        this.view = 'sidebar';
        /** Tabs */
        this.tabs = [];
        /** Hide Main Header */
        this.hideHeader = false;
        /** Hide Close Action */
        this.hideCloseAction = false;
        /** Icon Pack */
        this.iconPack = defaultIconPack;
        /** Option to focus close button when opened */
        this.focusCloseButton = true;
        /** Language */
        this.t = useLanguage();
        this.onClose = () => {
            var _a;
            this.sidebarClose.emit();
            /**
             * NOTE(ravindra-cloudflare):
             * If the sidebar was opened from a RealtimeKit component, apply a blur (remove focus/active class).
             * This helps remove the active border from RTK toggles, such as rtk-polls-toggle, rtk-chat-toggle, etc.
             */
            if (document.activeElement instanceof HTMLElement &&
                ((_a = document.activeElement.tagName) === null || _a === void 0 ? void 0 : _a.includes('RTK-')) &&
                document.activeElement.blur instanceof Function) {
                document.activeElement.blur();
            }
        };
    }
    componentDidLoad() {
        this.keydownListener = (e) => {
            if (e.key === 'Escape') {
                this.onClose();
            }
        };
        this.hostEl.addEventListener('keydown', this.keydownListener);
        this.handleFocusCloseButton();
    }
    handleFocusCloseButton() {
        if (this.currentTab !== 'chat' && !this.hideCloseAction) {
            this.closeButton.focus();
        }
    }
    disconnectedCallback() {
        this.hostEl.removeEventListener('keydown', this.keydownListener);
    }
    render() {
        const isFullScreen = this.view === 'full-screen';
        const activeTab = this.tabs.find((tab) => tab.id === this.currentTab);
        return (h(Host, { key: '239f279ceccceeaa57181d4a71f3e04ede4132ce', ref: (el) => (this.hostEl = el), class: this.view }, !this.hideCloseAction && (h("rtk-button", { key: '921847fd946de305dce6f1fc7fe8a9ff175e38ee', ref: (el) => (this.closeButton = el), variant: "ghost", kind: "icon", class: "close", onClick: this.onClose, "aria-label": this.t('close') }, h("rtk-icon", { key: '1de9f1edf8ecce2d0390b7b8a1253de02affd9d1', icon: this.iconPack.dismiss }))), activeTab && !this.hideHeader && (h("header", { key: '4cd288feeb658e62d3ad1efd47aea237119918e1', class: "main-header" }, h("h3", { key: 'd6c4129537b4e090f3c429c66057be9a1072a864' }, activeTab.name), h("slot", { key: 'dfb1ea30cfa476b515a3a4b628c036083f1fe0a5', name: "pinned-state" }))), isFullScreen && (h("header", { key: '7dafb426628960ba26718530417854a533de3664', class: "mobile-tabs" }, this.tabs.map((tab) => (h("button", { onClick: () => {
                this.tabChange.emit(tab.id);
            }, class: {
                active: this.currentTab === tab.id,
            } }, tab.name))))), h("slot", { key: '2696ccd9fcad418ad7738164cd5a9e6305320899', name: this.currentTab })));
    }
    static get watchers() { return {
        "currentTab": [{
                "handleFocusCloseButton": 0
            }]
    }; }
};
__decorate([
    SyncWithStore()
], RtkSidebarUi.prototype, "t", void 0);
RtkSidebarUi.style = rtkSidebarUiCss();

export { RtkSidebarUi as rtk_sidebar_ui };
