import { r as registerInstance, h, a as Host } from './index-gJCRRBX0.js';
import './breakout-rooms-manager-B1Qky9zO.js';
import { c as createDefaultConfig, e as defaultIconPack, i as useLanguage } from './ui-store-CkvSNsmd.js';
import './livestream-C0vp-Q7v.js';
import { R as Render } from './index-BUsisVB6.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';
import './breakout-rooms-Daj_55_i.js';

const rtkHeaderCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{display:flex;height:var(--rtk-space-12, 48px);align-items:center;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity));padding-left:var(--rtk-space-4, 16px);padding-right:var(--rtk-space-4, 16px)}@media only screen and (max-device-height: 480px) and (orientation: landscape){:host{display:none !important}}@media only screen and (max-height: 480px) and (orientation: landscape){:host{display:none !important}}`;

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
const RtkHeader = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** Variant */
        this.variant = 'solid';
        /** Whether to render the default UI */
        this.disableRender = false;
        /** Config */
        this.config = createDefaultConfig();
        /** Icon Pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
    }
    render() {
        const defaults = {
            meeting: this.meeting,
            config: this.config,
            states: this.states,
            t: this.t,
            iconPack: this.iconPack,
            size: this.size,
        };
        return (h(Host, { key: 'a323f95dac8cde8fdb77b1ecb0950402b7d418bb' }, !this.disableRender && h(Render, { key: 'a7beb145a76f2f879af3f54c9ec08317865b17d2', element: "rtk-header", defaults: defaults, onlyChildren: true }), h("slot", { key: '5bee25d9949611736d9c772e438314655ab8ae58' })));
    }
};
__decorate([
    SyncWithStore()
], RtkHeader.prototype, "meeting", void 0);
__decorate([
    SyncWithStore()
], RtkHeader.prototype, "config", void 0);
__decorate([
    SyncWithStore()
], RtkHeader.prototype, "states", void 0);
__decorate([
    SyncWithStore()
], RtkHeader.prototype, "iconPack", void 0);
__decorate([
    SyncWithStore()
], RtkHeader.prototype, "t", void 0);
RtkHeader.style = rtkHeaderCss();

export { RtkHeader as rtk_header };
