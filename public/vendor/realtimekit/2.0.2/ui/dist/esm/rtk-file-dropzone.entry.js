import { r as registerInstance, d as createEvent, h, a as Host } from './index-gJCRRBX0.js';
import './breakout-rooms-manager-B1Qky9zO.js';
import './livestream-C0vp-Q7v.js';
import { e as defaultIconPack, i as useLanguage } from './ui-store-CkvSNsmd.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';
import './breakout-rooms-Daj_55_i.js';

const rtkFileDropzoneCss = () => `#dropzone{position:absolute;top:var(--rtk-space-0, 0px);right:var(--rtk-space-0, 0px);bottom:var(--rtk-space-0, 0px);left:var(--rtk-space-0, 0px);z-index:10;display:none;flex-direction:column;align-items:center;justify-content:center;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-700, 255 255 255 / 0.64))}#dropzone.active{display:flex;animation:0.2s slide-up ease-in}`;

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
const RtkFileDropzone = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.onDropCallback = createEvent(this, "dropCallback", 7);
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.dropzoneActivated = false;
    }
    connectedCallback() {
        if (!this.hostEl)
            throw new Error('hostEl prop is required');
        this.hostEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropzoneActivated = true;
        });
        this.hostEl.addEventListener('dragleave', () => {
            this.dropzoneActivated = false;
        });
        this.hostEl.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropzoneActivated = false;
            this.onDropCallback.emit(e);
        });
    }
    render() {
        return (h(Host, { key: '31d5ca1c0b9612c257ca9fb2233c6c1d2a4d049f' }, h("div", { key: '697c79cbd3c736b7efb890fddfca94c393b48d08', id: "dropzone", class: { active: this.dropzoneActivated }, part: "dropzone" }, h("rtk-icon", { key: '3fea26663f603965ef5dfc7d548cdcfc892bbc90', icon: this.iconPack.attach }), h("p", { key: 'cab674da2e590d75ad20ca66661753cb52771925' }, this.t('chat.send_attachment')))));
    }
};
__decorate([
    SyncWithStore()
], RtkFileDropzone.prototype, "iconPack", void 0);
__decorate([
    SyncWithStore()
], RtkFileDropzone.prototype, "t", void 0);
RtkFileDropzone.style = rtkFileDropzoneCss();

export { RtkFileDropzone as rtk_file_dropzone };
