import { r as registerInstance, d as createEvent, h, a as Host, g as getElement } from './index-gJCRRBX0.js';
import { e as defaultIconPack, i as useLanguage } from './ui-store-CkvSNsmd.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';

const rtkMoreToggleCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{position:relative;display:flex;flex-direction:column;overflow:visible}.more-menu{position:absolute;right:calc(var(--rtk-space-24, 96px) * -1);bottom:var(--rtk-space-16, 64px);z-index:50;margin-bottom:var(--rtk-space-3, 12px);box-sizing:border-box;max-height:60vh;width:var(--rtk-space-64, 256px);overflow:auto;border-radius:var(--rtk-border-radius-md, 8px);border-width:var(--rtk-border-width-sm, 1px);border-style:solid;--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-border-opacity));--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity));outline:2px solid transparent;outline-offset:2px;display:flex;flex-direction:column;align-items:stretch}:host([size='sm']) .more-menu{bottom:var(--rtk-space-10, 40px)}.more-menu::-webkit-scrollbar{height:var(--rtk-space-0, 0px);width:var(--rtk-space-1\\.5, 6px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-900, 26 26 26) / var(--tw-bg-opacity))}.more-menu::-webkit-scrollbar-thumb{border-radius:var(--rtk-border-radius-sm, 4px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity))}`;

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
const RtkMoreToggle = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.stateUpdate = createEvent(this, "rtkStateUpdate", 7);
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.handleKeyDown = ({ key }) => {
            if (key === 'Escape') {
                this.stateUpdate.emit({ activeMoreMenu: false });
            }
        };
        this.handleOnClick = (e) => {
            if (!e.composedPath().includes(this.host) && this.states.activeMoreMenu) {
                this.stateUpdate.emit({ activeMoreMenu: false });
            }
        };
        this.toggleMoreMenu = () => {
            this.stateUpdate.emit({ activeMoreMenu: !this.states.activeMoreMenu });
        };
    }
    connectedCallback() {
        /** A11y */
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('click', this.handleOnClick);
        // };
    }
    disconnectedCallback() {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('click', this.handleOnClick);
    }
    render() {
        const text = this.t('more');
        return (h(Host, { key: 'bb6bc743afd9c5c2c91f48097f98afc0f58fface', title: text }, this.states.activeMoreMenu && (h("div", { key: 'ca5d042b877cd1bee68b2563d40764bbc2072df4', class: "more-menu" }, h("slot", { key: '9931da3f9e96d792be362c64338d582be2990647', name: "more-elements" }))), h("rtk-controlbar-button", { key: 'd0d7e0f19a37029c9cdfb8238c0a7af88876b2c0', size: this.size, iconPack: this.iconPack, onClick: (e) => {
                e.stopPropagation();
                this.toggleMoreMenu();
            }, icon: this.iconPack.horizontal_dots, label: text, part: "controlbar-button" }), h("slot", { key: '603c0b5f092419c98ed56614a1468b5802c95702', name: "expanded" })));
    }
    get host() { return getElement(this); }
};
__decorate([
    SyncWithStore()
], RtkMoreToggle.prototype, "states", void 0);
__decorate([
    SyncWithStore()
], RtkMoreToggle.prototype, "iconPack", void 0);
__decorate([
    SyncWithStore()
], RtkMoreToggle.prototype, "t", void 0);
RtkMoreToggle.style = rtkMoreToggleCss();

export { RtkMoreToggle as rtk_more_toggle };
