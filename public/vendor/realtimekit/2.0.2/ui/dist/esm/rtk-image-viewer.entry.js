import { r as registerInstance, d as createEvent, h, a as Host } from './index-gJCRRBX0.js';
import { i as useLanguage, e as defaultIconPack } from './ui-store-CkvSNsmd.js';
import { d as downloadFile } from './file-6Fkktc2w.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';
import { f as formatName, a as shorten } from './string-vBD2htwQ.js';

const rtkImageViewerCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}.scrollbar{scrollbar-width:thin;scrollbar-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))     var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar{height:var(--rtk-space-1\\.5, 6px);width:var(--rtk-space-1\\.5, 6px);border-radius:9999px;background-color:var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar-thumb{border-radius:9999px;background-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))}:host{width:1140px;max-width:100%;box-sizing:border-box;display:flex;flex-direction:column;padding:var(--rtk-space-6, 24px);padding-top:var(--rtk-space-5, 20px);overflow-y:auto;color:rgb(var(--rtk-colors-text-1000, 255 255 255));z-index:40;border-radius:var(--rtk-border-radius-md, 8px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-900, 26 26 26) / var(--tw-bg-opacity))}.displayName{font-weight:700}.image-ctr{margin-top:var(--rtk-space-2, 8px);box-sizing:border-box;display:flex;justify-content:center;overflow:hidden}.actions{display:flex;align-items:center;justify-content:flex-end;gap:var(--rtk-space-2, 8px)}img{box-sizing:border-box;display:block;max-height:100%;max-width:100%;-o-object-fit:contain;object-fit:contain}.header{display:flex;align-items:center;justify-content:space-between;padding-bottom:var(--rtk-space-4, 16px)}.shared-by-user{overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1}:host([size='sm']) .header{flex-direction:column}:host([size='sm']) .header .actions{margin-top:var(--rtk-space-4, 16px)}`;

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
const RtkImageViewer = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.close = createEvent(this, "close", 7);
        /** Language */
        this.t = useLanguage();
        /** Icon pack */
        this.iconPack = defaultIconPack;
        this.keypressListener = (e) => {
            if (e.key === 'Escape') {
                this.close.emit();
            }
        };
        this.handleOutsideClick = () => this.close.emit();
    }
    connectedCallback() {
        document.addEventListener('keydown', this.keypressListener);
        document.addEventListener('click', this.handleOutsideClick);
    }
    disconnectedCallback() {
        document.removeEventListener('keydown', this.keypressListener);
        document.removeEventListener('click', this.handleOutsideClick);
    }
    render() {
        return (h(Host, { key: '09122e4d61355092a9c82bc337ea002a6c2acd58', class: "scrollbar", onClick: (e) => e.stopPropagation() }, h("div", { key: '2c6c3f705abf067d866e02b81c4b3d610f09fede', class: "header" }, h("div", { key: '66cd4c200a2e8704acdf75d8830c94ac2abdc6be', class: "shared-by-user" }, this.t('chat.img.shared_by'), ' ', h("span", { key: '3b4a866b673f35a454e7115fdc5c915d68966b1d', class: "displayName" }, formatName(shorten(this.image.displayName)))), h("div", { key: '29e0e95e3e3d3b36917745a8f0a47beb9b5e3f02', class: "actions" }, h("rtk-button", { key: '5cd7383e265a02c8b57a0f712e9e445495498c32', onClick: () => downloadFile(this.image.link, { fallbackName: 'image' }) }, h("rtk-icon", { key: 'b098e89f707cc4cf413a620319e0eb2fd10b729a', icon: this.iconPack.download, slot: "start" }), "Download"), h("rtk-button", { key: '2cd6b7c21f0357d3104618d96d853d8bd8fcc542', kind: "icon", variant: "secondary", onClick: () => this.close.emit() }, h("rtk-icon", { key: '891428595d7a61c5400dc884bf8e1a501009eed5', icon: this.iconPack.dismiss })))), h("div", { key: '6194a26ac1357b93776b1c77ff72d1502151d619', class: "image-ctr" }, h("img", { key: '24f21e7fff100bea8e79d261f180a57dc14fa5f4', src: this.image.link }))));
    }
};
__decorate([
    SyncWithStore()
], RtkImageViewer.prototype, "t", void 0);
__decorate([
    SyncWithStore()
], RtkImageViewer.prototype, "iconPack", void 0);
RtkImageViewer.style = rtkImageViewerCss();

export { RtkImageViewer as rtk_image_viewer };
