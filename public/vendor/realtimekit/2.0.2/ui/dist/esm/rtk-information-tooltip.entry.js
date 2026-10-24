import { r as registerInstance, h, a as Host } from './index-gJCRRBX0.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';
import './breakout-rooms-manager-B1Qky9zO.js';
import './livestream-C0vp-Q7v.js';
import { e as defaultIconPack } from './ui-store-CkvSNsmd.js';
import './breakout-rooms-Daj_55_i.js';

const rtkInformationTooltipCss = () => `:host{margin-left:var(--rtk-space-2, 8px);margin-right:var(--rtk-space-2, 8px);cursor:pointer}.tooltip-container{position:relative;display:flex;flex-direction:row;align-items:center}.tooltip-container rtk-icon{cursor:pointer;color:rgb(var(--rtk-colors-text-600, 255 255 255 / 0.52))}.tooltip-container rtk-icon:hover+.tooltip{display:flex !important}.tooltip{position:absolute;margin-left:var(--rtk-space-2, 8px);display:none !important;border-radius:var(--rtk-border-radius-md, 8px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity));padding:var(--rtk-space-2, 8px);font-weight:400;color:rgb(var(--rtk-colors-text-600, 255 255 255 / 0.52));z-index:50;display:flex;min-width:var(--rtk-space-60, 240px);flex-direction:column;--tw-shadow:0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);--tw-shadow-colored:0 4px 6px -1px var(--tw-shadow-color), 0 2px 4px -2px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);left:14px}`;

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
const RtkInformationTooltip = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** Icon pack */
        this.iconPack = defaultIconPack;
    }
    render() {
        return (h(Host, { key: 'ff8e44d0644f3a81e71ec3595f109c396effd80e' }, h("div", { key: '9b07fcd50ec2050f65008ad447b42fe0a2431fba', class: "tooltip-container" }, h("rtk-icon", { key: '09393761a1ee443f54d08034c451397adf05c0a2', icon: this.iconPack.info, size: "sm" }), h("div", { key: 'edcc65636e3888864a4f619b34929a494a748b43', class: "tooltip" }, h("slot", { key: '298db1c52802862d8d1da4a3b9cfc33e3695163d', name: "tootlip-text" })))));
    }
};
__decorate([
    SyncWithStore()
], RtkInformationTooltip.prototype, "iconPack", void 0);
RtkInformationTooltip.style = rtkInformationTooltipCss();

export { RtkInformationTooltip as rtk_information_tooltip };
