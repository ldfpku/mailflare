import { r as registerInstance, e as writeTask, h, a as Host, d as createEvent } from './index-gJCRRBX0.js';
import { e as defaultIconPack, i as useLanguage, c as createDefaultConfig } from './ui-store-CkvSNsmd.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';
import './breakout-rooms-manager-B1Qky9zO.js';
import './livestream-C0vp-Q7v.js';
import { R as Render } from './index-BUsisVB6.js';
import './breakout-rooms-Daj_55_i.js';

const rtkCameraSelectorCss = () => `.rtk-select{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-1000, 255 255 255))}.rtk-select:focus{--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(0px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000)}.rtk-select{display:block;border-radius:var(--rtk-border-radius-sm, 4px);border-width:var(--rtk-border-width-none, 0);border-style:none;-webkit-appearance:none;-moz-appearance:none;appearance:none;padding:var(--rtk-space-3, 12px);font-size:16px;--icon-size:var(--rtk-select-chevron-size, var(--rtk-space-6, 24px));--icon-right-position:var(--rtk-select-chevron-right-position, var(--rtk-space-2, 8px));background-image:url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");background-position:right var(--icon-right-position) center;background-repeat:no-repeat;background-size:var(--icon-size) var(--icon-size);padding-right:calc(var(--icon-right-position) * 5);width:100%;max-width:100%;text-overflow:ellipsis}.inline .rtk-select{margin-top:var(--rtk-space-1, 4px);width:100%;padding-top:var(--rtk-space-1, 4px);padding-bottom:var(--rtk-space-1, 4px);padding-left:var(--rtk-space-1\\.5, 6px);padding-right:var(--rtk-space-1\\.5, 6px);padding-right:var(--rtk-space-8, 32px);font-size:14px}.row{margin-bottom:var(--rtk-space-2, 8px);display:flex;width:100%;align-items:center;justify-content:space-between;gap:var(--rtk-space-3, 12px)}.group{margin-top:var(--rtk-space-2, 8px);margin-bottom:var(--rtk-space-2, 8px)}.group>*{margin-bottom:var(--rtk-space-2, 8px)}.group>*:last-child{margin-bottom:var(--rtk-space-0, 0px)}.group select{flex:1 1 0%}.group{margin-top:var(--rtk-space-0, 0px);margin-bottom:var(--rtk-space-0, 0px)}.group>*{margin-bottom:var(--rtk-space-0, 0px)}label{display:flex;-webkit-user-select:none;-moz-user-select:none;user-select:none;align-items:center;gap:var(--rtk-space-1, 4px);font-size:14px}.inline.container{display:flex;align-items:center;justify-content:flex-start;gap:var(--rtk-space-2, 8px);padding-left:var(--rtk-space-2, 8px);padding-right:var(--rtk-space-2, 8px)}`;

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
const RtkCameraSelector = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** variant */
        this.variant = 'full';
        /** Language */
        this.t = useLanguage();
        this.videoDevices = [];
        this.canProduceVideo = true;
        this.stageStateListener = () => {
            this.canProduceVideo = this.meeting.self.permissions.canProduceVideo === 'ALLOWED';
        };
        this.deviceListUpdateListener = ({ devices }) => {
            this.videoDevices = devices.filter((device) => device.kind === 'videoinput');
        };
        this.deviceUpdateListener = ({ device }) => {
            if (device.kind !== 'videoinput')
                return;
            this.currentDevice = device;
        };
        this.mediaPermissionUpdateListener = async ({ kind, message }) => {
            if (!this.meeting)
                return;
            if (kind === 'video' && message === 'ACCEPTED') {
                this.videoDevices = await this.meeting.self.getVideoDevices();
            }
        };
    }
    meetingChanged(meeting) {
        var _a, _b, _c;
        if (!meeting)
            return;
        (_a = meeting.self) === null || _a === void 0 ? void 0 : _a.addListener('deviceListUpdate', this.deviceListUpdateListener);
        (_b = meeting.self) === null || _b === void 0 ? void 0 : _b.addListener('deviceUpdate', this.deviceUpdateListener);
        (_c = meeting.self) === null || _c === void 0 ? void 0 : _c.addListener('mediaPermissionUpdate', this.mediaPermissionUpdateListener);
        writeTask(async () => {
            var _a, _b;
            const videoDevices = await meeting.self.getVideoDevices();
            const currentVideoDevice = (_a = meeting.self.getCurrentDevices()) === null || _a === void 0 ? void 0 : _a.video;
            //  NOTE(callmetarush): Setting current video device to show on top of list
            if (currentVideoDevice != undefined) {
                this.videoDevices = [
                    (_b = videoDevices.find((device) => device.deviceId === currentVideoDevice.deviceId)) !== null && _b !== void 0 ? _b : currentVideoDevice,
                    ...videoDevices.filter((device) => device.deviceId !== currentVideoDevice.deviceId),
                ];
            }
            else {
                this.videoDevices = videoDevices;
            }
        });
    }
    connectedCallback() {
        this.meetingChanged(this.meeting);
    }
    disconnectedCallback() {
        var _a, _b, _c, _d, _e;
        (_b = (_a = this.meeting) === null || _a === void 0 ? void 0 : _a.stage) === null || _b === void 0 ? void 0 : _b.removeListener('stageStatusUpdate', this.stageStateListener);
        (_c = this.meeting) === null || _c === void 0 ? void 0 : _c.self.removeListener('deviceListUpdate', this.deviceListUpdateListener);
        (_d = this.meeting) === null || _d === void 0 ? void 0 : _d.self.removeListener('deviceUpdate', this.deviceUpdateListener);
        (_e = this.meeting) === null || _e === void 0 ? void 0 : _e.self.removeListener('mediaPermissionUpdate', this.mediaPermissionUpdateListener);
    }
    async setDevice(deviceId) {
        var _a;
        const device = this.videoDevices.find((d) => d.deviceId === deviceId);
        this.currentDevice = device;
        if (device != null) {
            await ((_a = this.meeting) === null || _a === void 0 ? void 0 : _a.self.setDevice(device));
        }
    }
    render() {
        if (!this.meeting)
            return null;
        let unnamedVideoCount = 0;
        return (h(Host, null, this.canProduceVideo && (h("div", { class: 'group container ' + this.variant, part: "camera-selection" }, h("label", null, this.variant !== 'inline' && this.t('camera'), h("rtk-icon", { icon: this.iconPack.video_on, size: "sm" })), h("div", { class: "row" }, h("select", { class: "rtk-select", onChange: (e) => this.setDevice(e.target.value) }, this.videoDevices.map(({ deviceId, label }) => {
            var _a;
            return (h("option", { selected: ((_a = this.currentDevice) === null || _a === void 0 ? void 0 : _a.deviceId) === deviceId, value: deviceId }, label || `Camera ${++unnamedVideoCount}`));
        })))))));
    }
    static get watchers() { return {
        "meeting": [{
                "meetingChanged": 0
            }]
    }; }
};
__decorate$1([
    SyncWithStore()
], RtkCameraSelector.prototype, "meeting", void 0);
__decorate$1([
    SyncWithStore()
], RtkCameraSelector.prototype, "iconPack", void 0);
__decorate$1([
    SyncWithStore()
], RtkCameraSelector.prototype, "t", void 0);
RtkCameraSelector.style = rtkCameraSelectorCss();

const rtkParticipantTileCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{position:relative;display:flex;align-items:center;justify-content:center;aspect-ratio:16 / 9;height:var(--rtk-space-56, 224px);overflow:hidden;border-radius:var(--rtk-border-radius-lg, 12px);-webkit-user-select:none;-moz-user-select:none;user-select:none;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-video-bg, 24 24 24) / var(--tw-bg-opacity));transition-property:var(--rtk-transition-property, all);transition-duration:150ms;container-type:inline-size;container-name:participanttile}@media (prefers-reduced-motion){:host{--rtk-transition-property:none}}rtk-avatar{z-index:-1}::slotted(rtk-name-tag),rtk-name-tag{position:absolute;left:var(--rtk-space-3, 12px);bottom:var(--rtk-space-3, 12px)}:host([size='sm'][variant='solid']) ::slotted(rtk-name-tag),:host([size='sm'][variant='solid']) rtk-name-tag{left:var(--rtk-space-2, 8px);bottom:var(--rtk-space-2, 8px);height:var(--rtk-space-4, 16px)}::slotted(rtk-network-indicator),rtk-network-indicator{position:absolute;right:var(--rtk-space-3, 12px);bottom:var(--rtk-space-3, 12px)}:host([size='sm']) ::slotted(rtk-network-indicator),:host([size='sm']) rtk-network-indicator{right:var(--rtk-space-2, 8px);bottom:var(--rtk-space-2, 8px)}video{position:absolute;height:100%;width:100%;border-radius:var(--rtk-border-radius-lg, 12px)}video.contain{-o-object-fit:contain;object-fit:contain}video.cover{-o-object-fit:cover;object-fit:cover}video::-webkit-media-controls{display:none !important}.pinned-icon{position:absolute;left:var(--rtk-space-3, 12px);top:var(--rtk-space-3, 12px);height:var(--rtk-space-5, 20px);width:var(--rtk-space-5, 20px);padding:var(--rtk-space-1, 4px);border-radius:var(--rtk-border-radius-md, 8px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity))}.network-container{position:absolute;right:var(--rtk-space-3, 12px);bottom:var(--rtk-space-3, 12px);display:flex;flex-direction:row;align-items:center;padding:var(--rtk-space-2, 8px);font-size:12px;border-radius:var(--rtk-border-radius-md, 8px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity))}.network-icon{height:var(--rtk-space-5, 20px);width:var(--rtk-space-5, 20px);--tw-text-opacity:1;color:rgba(var(--rtk-colors-danger, 255 45 45) / var(--tw-text-opacity))}:host([size='sm']) .pinned-icon{top:var(--rtk-space-2, 8px);left:var(--rtk-space-2, 8px)}:host([variant='gradient']) ::slotted(rtk-audio-visualizer),:host([variant='gradient']) rtk-audio-visualizer{position:absolute;top:var(--rtk-space-2, 8px);right:var(--rtk-space-2, 8px);border-radius:9999px;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / var(--tw-bg-opacity));padding:var(--rtk-space-2, 8px)}:host([variant='gradient']) ::slotted(rtk-name-tag),:host([variant='gradient']) rtk-name-tag{bottom:var(--rtk-space-0, 0px);left:var(--rtk-space-0, 0px);display:flex;width:100%;align-items:center;justify-content:center;text-align:center;background-color:transparent;background-image:linear-gradient(to top, var(--tw-gradient-stops));--tw-gradient-from:rgb(var(--rtk-colors-background-1000, 8 8 8));--tw-gradient-to:rgba(var(--rtk-colors-background-1000, 8 8 8) / 0);--tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to);--tw-gradient-to:transparent}video.mirror{transform:scaleX(-1)}:host([name-tag-position='bottom-right']) ::slotted(rtk-name-tag),:host([name-tag-position='bottom-right']) rtk-name-tag{left:auto;right:var(--rtk-space-3, 12px)}:host([name-tag-position='bottom-center']) ::slotted(rtk-name-tag),:host([name-tag-position='bottom-center']) rtk-name-tag{left:auto;right:auto}:host([name-tag-position='top-left']) ::slotted(rtk-name-tag),:host([name-tag-position='top-left']) rtk-name-tag{top:var(--rtk-space-3, 12px);bottom:auto}:host([name-tag-position='top-right']) ::slotted(rtk-name-tag),:host([name-tag-position='top-right']) rtk-name-tag{top:var(--rtk-space-3, 12px);right:var(--rtk-space-3, 12px);left:auto;bottom:auto}:host([name-tag-position='top-center']) ::slotted(rtk-name-tag),:host([name-tag-position='top-center']) rtk-name-tag{left:auto;right:auto;bottom:auto;top:var(--rtk-space-3, 12px)}@media only screen and (max-height: 480px) and (orientation: landscape){:host([size='sm']){border-radius:var(--rtk-border-radius-sm, 4px)}:host([size='sm'])>video{border-radius:var(--rtk-border-radius-sm, 4px)}::slotted(rtk-avatar),rtk-avatar{height:var(--rtk-space-12, 48px);width:var(--rtk-space-12, 48px)}:host([size='sm'][variant='solid']) ::slotted(rtk-name-tag),:host([size='sm'][variant='solid']) rtk-name-tag{transform-origin:-2% 100%;transform:scale(0.6);z-index:10;left:var(--rtk-space-0, 0px);bottom:var(--rtk-space-0, 0px);border-radius:var(--rtk-border-radius-none, 0)}}@media only screen and (max-width: 480px) and (orientation: portrait){:host([size='sm']){border-radius:var(--rtk-border-radius-sm, 4px)}:host([size='sm'])>video{border-radius:var(--rtk-border-radius-sm, 4px)}::slotted(rtk-avatar),rtk-avatar{height:var(--rtk-space-12, 48px);width:var(--rtk-space-12, 48px)}:host([size='sm'][variant='solid']) ::slotted(rtk-name-tag),:host([size='sm'][variant='solid']) rtk-name-tag{transform-origin:-5% 110%;transform:scale(0.6);z-index:10;left:var(--rtk-space-0, 0px);bottom:var(--rtk-space-0, 0px);border-radius:var(--rtk-border-radius-none, 0)}}@container participanttile (max-width: 300px){::slotted(rtk-name-tag),rtk-name-tag{transform-origin:0 100%;transform:scale(0.8)}::slotted(rtk-avatar),rtk-avatar{height:var(--rtk-space-8, 32px) !important;width:var(--rtk-space-8, 32px) !important}}@container participanttile (max-width: 150px){::slotted(rtk-name-tag),rtk-name-tag[variant='solid']{transform-origin:-10% 130%;transform:scale(0.6);z-index:10;border-radius:9999px}::slotted(rtk-avatar),rtk-avatar{height:6 !important;width:6 !important}}`;

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
const RtkParticipantTile = class {
    onVideoRef(el) {
        if (!this.participant || !this.meeting || el === this.videoEl)
            return;
        this.videoEl = el;
        this.participant.registerVideoElement(this.videoEl, this.isPreview);
        this.tileLoad.emit({ participant: this.participant, videoElement: this.videoEl });
    }
    connectedCallback() {
        // set videoState before initial render and initialize listeners
        if (this.meeting)
            this.meetingChanged(this.meeting);
        else
            this.participantsChanged(this.participant);
    }
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.tileLoad = createEvent(this, "tileLoad", 7);
        this.tileUnload = createEvent(this, "tileUnload", 7);
        this.isPinned = false;
        this.mediaConnectionError = false;
        /** Position of name tag */
        this.nameTagPosition = 'bottom-left';
        /** Whether tile is used for preview */
        this.isPreview = false;
        /** Config object */
        this.config = createDefaultConfig();
        /** Variant */
        this.variant = 'solid';
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.onPinned = ({ isPinned }) => {
            this.isPinned = isPinned;
        };
        this.isSelf = () => { var _a; return this.isPreview || this.participant.id === ((_a = this.meeting) === null || _a === void 0 ? void 0 : _a.self.id); };
        this.onPlaying = () => {
            if (this.playTimeout)
                clearTimeout(this.playTimeout);
        };
        this.mediaConnectionUpdateListener = this.mediaConnectionUpdateListener.bind(this);
    }
    disconnectedCallback() {
        if (this.playTimeout)
            clearTimeout(this.playTimeout);
        if (this.participant == null)
            return;
        this.participant.deregisterVideoElement(this.videoEl, this.isPreview);
        this.participant.removeListener('pinned', this.onPinned);
        this.participant.removeListener('unpinned', this.onPinned);
        this.meeting.meta.off('mediaConnectionUpdate', this.mediaConnectionUpdateListener);
        this.tileUnload.emit(this.participant);
    }
    meetingChanged(meeting) {
        if (!meeting)
            return;
        this.participantsChanged(this.participant);
    }
    participantsChanged(participant) {
        if (!participant)
            return;
        if (!this.meeting) {
            if (this.isPreview) {
                this.videoEl && this.participant.registerVideoElement(this.videoEl, this.isPreview);
            }
            return;
        }
        this.isPinned = participant.isPinned;
        this.videoEl && this.participant.registerVideoElement(this.videoEl, this.isPreview);
        participant.addListener('pinned', this.onPinned);
        participant.addListener('unpinned', this.onPinned);
        this.meeting.meta.off('mediaConnectionUpdate', this.mediaConnectionUpdateListener);
        this.meeting.meta.on('mediaConnectionUpdate', this.mediaConnectionUpdateListener);
    }
    mediaConnectionUpdateListener() {
        var _a, _b, _c;
        const { recv: consuming, send: producing } = (_c = (_b = (_a = this.meeting) === null || _a === void 0 ? void 0 : _a.meta) === null || _b === void 0 ? void 0 : _b.mediaState) !== null && _c !== void 0 ? _c : {};
        if ((consuming === null || consuming === void 0 ? void 0 : consuming.state) !== 'connected' && !this.isSelf()) {
            this.mediaConnectionError = true;
        }
        else if ((producing === null || producing === void 0 ? void 0 : producing.state) !== 'connected' && this.isSelf()) {
            this.mediaConnectionError = true;
        }
        else
            this.mediaConnectionError = false;
    }
    isMirrored() {
        var _a;
        if (this.participant != null) {
            if (this.isSelf()) {
                const states = this.states;
                const mirrorVideo = (_a = states === null || states === void 0 ? void 0 : states.prefs) === null || _a === void 0 ? void 0 : _a.mirrorVideo;
                if (typeof mirrorVideo === 'boolean') {
                    return mirrorVideo;
                }
            }
        }
        return false;
    }
    render() {
        var _a, _b, _c;
        if (!this.meeting)
            return null;
        const defaults = {
            meeting: this.meeting,
            size: this.size,
            states: this.states,
            config: this.config,
            iconPack: this.iconPack,
            t: this.t,
        };
        return (h(Host, null, h("video", { ref: (el) => this.onVideoRef(el), class: {
                mirror: this.isMirrored(),
                [(_c = (_b = (_a = this.config) === null || _a === void 0 ? void 0 : _a.config) === null || _b === void 0 ? void 0 : _b.videoFit) !== null && _c !== void 0 ? _c : 'cover']: true,
            }, onPlaying: this.onPlaying, autoPlay: true, playsInline: true, muted: true, part: "video" }), this.isPinned && (h("rtk-icon", { class: "pinned-icon", icon: this.iconPack.pin, "aria-label": this.t('pinned'), part: "pinned-icon" })), this.mediaConnectionError && (h("div", { class: "network-container", part: "network-indicator" }, h("rtk-icon", { class: "network-icon", icon: this.iconPack.disconnected, "aria-label": this.t('pinned'), part: "pinned-icon" }))), h("slot", null, !this.isPreview && (h(Render, { element: "rtk-participant-tile", defaults: defaults, childProps: {
                participant: this.participant,
            }, deepProps: true, onlyChildren: true })))));
    }
    static get watchers() { return {
        "meeting": [{
                "meetingChanged": 0
            }],
        "participant": [{
                "participantsChanged": 0
            }]
    }; }
};
__decorate([
    SyncWithStore()
], RtkParticipantTile.prototype, "meeting", void 0);
__decorate([
    SyncWithStore()
], RtkParticipantTile.prototype, "states", void 0);
__decorate([
    SyncWithStore()
], RtkParticipantTile.prototype, "config", void 0);
__decorate([
    SyncWithStore()
], RtkParticipantTile.prototype, "iconPack", void 0);
__decorate([
    SyncWithStore()
], RtkParticipantTile.prototype, "t", void 0);
RtkParticipantTile.style = rtkParticipantTileCss();

export { RtkCameraSelector as rtk_camera_selector, RtkParticipantTile as rtk_participant_tile };
