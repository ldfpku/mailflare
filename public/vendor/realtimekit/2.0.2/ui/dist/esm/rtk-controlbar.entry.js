import { r as registerInstance, h, a as Host } from './index-gJCRRBX0.js';
import './breakout-rooms-manager-B1Qky9zO.js';
import { c as createDefaultConfig, e as defaultIconPack, i as useLanguage } from './ui-store-CkvSNsmd.js';
import './livestream-C0vp-Q7v.js';
import { R as Render } from './index-BUsisVB6.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';
import './breakout-rooms-Daj_55_i.js';

const rtkControlbarCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{box-sizing:border-box;display:flex;align-items:center;gap:var(--rtk-space-0\\.5, 2px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity));padding-left:var(--rtk-space-4, 16px);padding-right:var(--rtk-space-4, 16px);position:relative;z-index:10}@media only screen and (max-device-height: 480px) and (orientation: landscape){:host{padding-top:var(--rtk-space-0, 0px) !important}}`;

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
const RtkControlbar = class {
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
        return (h(Host, { key: '68af3001ce88b084a7f11db7bbd201cad5bf477f' }, !this.disableRender && (h(Render, { key: '0f9084065a6ffb76744d97c78b81cb62022fe6af', element: "rtk-controlbar", defaults: defaults, onlyChildren: true })), h("slot", { key: 'fb6acf7e94afc107c0ce8dc721c568020f5fd35c' })));
    }
};
__decorate([
    SyncWithStore()
], RtkControlbar.prototype, "meeting", void 0);
__decorate([
    SyncWithStore()
], RtkControlbar.prototype, "config", void 0);
__decorate([
    SyncWithStore()
], RtkControlbar.prototype, "states", void 0);
__decorate([
    SyncWithStore()
], RtkControlbar.prototype, "iconPack", void 0);
__decorate([
    SyncWithStore()
], RtkControlbar.prototype, "t", void 0);
RtkControlbar.style = rtkControlbarCss();

export { RtkControlbar as rtk_controlbar };
