import { r as registerInstance, d as createEvent, e as writeTask, h, a as Host, g as getElement } from './index-gJCRRBX0.js';
import { e as defaultIconPack, i as useLanguage } from './ui-store-CkvSNsmd.js';
import { i as isFullScreenEnabled, r as requestFullScreen, e as exitFullScreen, a as isFullScreenSupported } from './full-screen-GSFejkz7.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';

const rtkScreenshareViewCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{height:100%;width:100%;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;border-radius:var(--rtk-border-radius-lg, 12px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-video-bg, 24 24 24) / var(--tw-bg-opacity));container-type:inline-size;container-name:screentile}::slotted(rtk-name-tag){position:absolute;left:var(--rtk-space-3, 12px);bottom:var(--rtk-space-3, 12px);opacity:0.8}#video-container{position:absolute;display:block;height:100%;width:100%}#video-container .fit-in-container{-o-object-fit:fill;object-fit:fill}video{height:100%;width:100%;-o-object-fit:contain;object-fit:contain}:host([variant='gradient']) ::slotted(rtk-audio-visualizer){position:absolute;top:var(--rtk-space-2, 8px);right:var(--rtk-space-2, 8px);border-radius:9999px;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / var(--tw-bg-opacity));padding:var(--rtk-space-2, 8px)}:host([variant='gradient']) ::slotted(rtk-name-tag){bottom:var(--rtk-space-0, 0px);left:var(--rtk-space-0, 0px);display:flex;width:100%;align-items:center;justify-content:center;text-align:center;background-color:transparent;background-image:linear-gradient(to top, var(--tw-gradient-stops));--tw-gradient-from:rgb(var(--rtk-colors-background-1000, 8 8 8));--tw-gradient-to:rgba(var(--rtk-colors-background-1000, 8 8 8) / 0);--tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to);--tw-gradient-to:transparent}:host([size='sm'][variant='gradient']) ::slotted(rtk-audio-visualizer){height:var(--rtk-space-5, 20px);width:var(--rtk-space-5, 20px)}video.visible{animation:video-fadein 0.4s ease}#controls{display:none;position:absolute;top:var(--rtk-space-3, 12px);right:var(--rtk-space-3, 12px);align-items:center;justify-content:flex-end;gap:var(--rtk-space-2, 8px)}:host(:hover) #controls,:host(:active) #controls,:host(:focus-visible) #controls{display:flex}#full-screen-btn{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity))}h3{margin-top:var(--rtk-space-10, 40px);margin-bottom:var(--rtk-space-6, 24px);text-align:center;font-size:20px;font-weight:500}:host([size='sm']) h3{font-size:16px}#self-message{padding-left:var(--rtk-space-4, 16px);padding-right:var(--rtk-space-4, 16px)}:host(.isSelf) #self-view{flex:1 1 0%}:host(.isSelf) #video-container{position:static;aspect-ratio:auto;height:auto;width:50%;max-width:var(--rtk-space-96, 384px);border-radius:var(--rtk-border-radius-md, 8px);transition:0.6s ease}:host(.isSelf) #video-container.expand{width:60%;max-width:100%}.actions{display:flex;align-items:center;justify-content:center;gap:var(--rtk-space-2, 8px)}:host([size='sm'].isSelf) #video-container,:host([size='md'].isSelf) #video-container,:host([size='sm'].isSelf) #expand-btn,:host([size='md'].isSelf) #expand-btn{display:none}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}.remote-control{z-index:10;height:100%;max-height:100%;flex:0 1 auto}#remote-control-self{position:absolute;top:var(--rtk-space-0, 0px);left:50%;z-index:10;width:-moz-max-content;width:max-content;max-width:100%;box-sizing:border-box;display:flex;height:var(--rtk-space-8, 32px);align-items:center;overflow:hidden;border-radius:var(--rtk-border-radius-sm, 4px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-warning, 255 205 7) / var(--tw-bg-opacity));font-size:12px;color:rgb(var(--rtk-colors-text-1000, 255 255 255));transform:translateX(-50%)}#remote-control-self p{padding-left:var(--rtk-space-3, 12px);padding-right:var(--rtk-space-3, 12px);padding-top:var(--rtk-space-2, 8px);padding-bottom:var(--rtk-space-2, 8px)}#remote-control-self rtk-button{height:100%;border-radius:var(--rtk-border-radius-none, 0);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-danger, 255 45 45) / var(--tw-bg-opacity));font-size:12px}:host([size='sm']) #remote-control-self{height:auto;flex-direction:column}:host([size='sm']) #remote-control-self rtk-button{width:100%;padding-top:var(--rtk-space-1, 4px);padding-bottom:var(--rtk-space-1, 4px)}:host([name-tag-position='bottom-right']) ::slotted(rtk-name-tag){left:auto;right:var(--rtk-space-3, 12px)}:host([name-tag-position='bottom-center']) ::slotted(rtk-name-tag){left:auto;right:auto}:host([name-tag-position='top-left']) ::slotted(rtk-name-tag){top:var(--rtk-space-3, 12px);bottom:auto}:host([name-tag-position='top-right']) ::slotted(rtk-name-tag){top:var(--rtk-space-3, 12px);right:var(--rtk-space-3, 12px);left:auto;bottom:auto}:host([name-tag-position='top-center']) ::slotted(rtk-name-tag){left:auto;right:auto;bottom:auto;top:var(--rtk-space-3, 12px)}@keyframes video-fadein{0%{opacity:0;transform:scale(1.4) translateY(20px)}100%{opacity:1;transform:scale(1) translateY(0)}}::slotted(rtk-network-indicator){position:absolute;right:var(--rtk-space-3, 12px);bottom:var(--rtk-space-3, 12px)}@media only screen and (max-height: 480px) and (orientation: landscape){:host([size='sm'][variant='solid']) ::slotted(rtk-name-tag),:host([size='sm'][variant='solid']) rtk-name-tag{left:var(--rtk-space-0, 0px);bottom:var(--rtk-space-0, 0px);border-radius:var(--rtk-border-radius-none, 0);transform-origin:0% 110%;transform:scale(0.6)}}@container screentile (max-width: 400px){::slotted(rtk-name-tag){transform-origin:0 130%;transform:scale(0.7)}}`;

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
const RtkScreenshareView = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.stateUpdate = createEvent(this, "rtkStateUpdate", 7);
        this.play = createEvent(this, "screensharePlay", 7);
        this.fullScreenListener = () => {
            this.isFullScreen = isFullScreenEnabled();
        };
        this.participantScreenshareUpdate = (p) => {
            if (p.id !== this.participant.id)
                return;
            this.screenShareListener(p);
        };
        /** Hide full screen button */
        this.hideFullScreenButton = false;
        /** Position of name tag */
        this.nameTagPosition = 'bottom-left';
        /** Variant */
        this.variant = 'solid';
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.videoExpanded = false;
        this.screenShareEnabled = false;
        this.isFullScreen = false;
        this.toggleFullScreen = () => {
            if (!this.isFullScreen) {
                requestFullScreen(this.host);
                this.isFullScreen = true;
            }
            else {
                exitFullScreen();
                this.isFullScreen = false;
            }
        };
    }
    connectedCallback() {
        window === null || window === void 0 ? void 0 : window.addEventListener('fullscreenchange', this.fullScreenListener);
        window === null || window === void 0 ? void 0 : window.addEventListener('webkitfullscreenchange', this.fullScreenListener);
    }
    componentDidLoad() {
        this.participantChanged(this.participant);
    }
    disconnectedCallback() {
        if (!this.meeting)
            return;
        const { self } = this.meeting;
        if (this.participant.id === self.id && this.screenShareListener)
            this.participant.removeListener('screenShareUpdate', this.screenShareListener);
        else
            this.meeting.participants.joined.removeListener('screenShareUpdate', this.participantScreenshareUpdate);
        window === null || window === void 0 ? void 0 : window.removeEventListener('fullscreenchange', this.fullScreenListener);
        window === null || window === void 0 ? void 0 : window.removeEventListener('webkitfullscreenchange', this.fullScreenListener);
    }
    participantChanged(participant) {
        if (participant != null && this.meeting) {
            const { self } = this.meeting;
            this.screenShareListener = ({ screenShareEnabled, screenShareTracks }) => {
                const enabled = screenShareEnabled && screenShareTracks.video != null;
                writeTask(() => {
                    this.screenShareEnabled = enabled;
                });
                if (enabled) {
                    const stream = new MediaStream();
                    stream.addTrack(screenShareTracks.video);
                    if (this.videoEl != null) {
                        this.videoEl.srcObject = stream;
                        this.videoEl.play();
                    }
                }
                else if (this.videoEl != null) {
                    this.videoEl.srcObject = undefined;
                }
            };
            this.screenShareListener(participant);
            if (participant.id === self.id)
                participant.addListener('screenShareUpdate', this.screenShareListener);
            else
                this.meeting.participants.joined.addListener('screenShareUpdate', this.participantScreenshareUpdate);
        }
    }
    render() {
        var _a, _b;
        const isSelf = ((_a = this.participant) === null || _a === void 0 ? void 0 : _a.id) === ((_b = this.meeting) === null || _b === void 0 ? void 0 : _b.self.id);
        const text = this.isFullScreen ? this.t('full_screen.exit') : this.t('full_screen');
        const icon = this.isFullScreen
            ? this.iconPack.full_screen_minimize
            : this.iconPack.full_screen_maximize;
        return (h(Host, { key: '10646f5ea7b7b9bc162c2a98af07928a0f68f605', class: { isSelf } }, h("div", { key: "video-container", id: "video-container", class: { expand: this.videoExpanded } }, h("video", { key: '13e87cfee55fdd6d45a72ec55792fbbfefdc5206', ref: (el) => (this.videoEl = el), class: {
                visible: this.screenShareEnabled,
                'fit-in-container': this.participant.supportsRemoteControl,
            }, playsInline: true, onPlay: () => {
                this.play.emit({
                    screenshareParticipant: this.participant,
                    participant: this.meeting.self,
                });
            }, autoPlay: true, muted: true, id: `screen-share-video-${this.participant.id}` })), h("div", { id: "controls", key: "controls" }, !this.hideFullScreenButton && !isSelf && isFullScreenSupported() && (h("rtk-tooltip", { key: '97ba6869139126f0114aee3239999bfe1172a798', label: text }, h("rtk-button", { key: '0769449ffcba69117d10a7346e4881c207e7ac6f', id: "full-screen-btn", kind: "icon", onClick: this.toggleFullScreen, title: text }, h("rtk-icon", { key: '508cf201f0b2e6da061e35dff4d3899f1da0749a', icon: icon, "aria-hidden": true, tabIndex: -1 }))))), isSelf && (h("div", { id: "self-message", key: "self-message" }, h("h3", { key: '6f055da4722c11893e3f8640bddad7f6844838da' }, this.t('screenshare.shared')), h("div", { key: '96fa5f8b47cef2a2a58352e4275c3c325f22a465', class: "actions" }, this.meeting != null && (h("rtk-button", { key: '144c3908476ac18d1ffcc1282a46a4d7fad698c2', variant: "danger", onClick: () => {
                this.meeting.self.disableScreenShare();
            } }, h("rtk-icon", { key: '7a6f710ccb916ca78edbb5daa9b6bcf3547ed54e', icon: this.iconPack.share_screen_stop, slot: "start" }), this.t('screenshare.stop'))), h("rtk-button", { key: '1667e04e5a22c3edfdab9300ffca06df7eba4948', variant: "secondary", id: "expand-btn", onClick: () => {
                this.videoExpanded = !this.videoExpanded;
            } }, h("rtk-icon", { key: '6140671792e626d5de181861ee4c7aef1dd11e3e', icon: this.videoExpanded
                ? this.iconPack.full_screen_minimize
                : this.iconPack.full_screen_maximize, slot: "start" }), this.videoExpanded
            ? this.t('screenshare.min_preview')
            : this.t('screenshare.max_preview'))))), h("slot", { key: 'beeecb6fe5a1f46d259a86e698c31fb477949bf3' })));
    }
    get host() { return getElement(this); }
    static get watchers() { return {
        "participant": [{
                "participantChanged": 0
            }]
    }; }
};
__decorate([
    SyncWithStore()
], RtkScreenshareView.prototype, "meeting", void 0);
__decorate([
    SyncWithStore()
], RtkScreenshareView.prototype, "iconPack", void 0);
__decorate([
    SyncWithStore()
], RtkScreenshareView.prototype, "t", void 0);
RtkScreenshareView.style = rtkScreenshareViewCss();

export { RtkScreenshareView as rtk_screenshare_view };
