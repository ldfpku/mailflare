import { r as registerInstance, h, a as Host, g as getElement } from './index-gJCRRBX0.js';
import './breakout-rooms-manager-B1Qky9zO.js';
import './livestream-C0vp-Q7v.js';
import { e as defaultIconPack, i as useLanguage } from './ui-store-CkvSNsmd.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';
import { R as Render } from './index-BUsisVB6.js';
import './breakout-rooms-Daj_55_i.js';

const rtkAudioGridCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}.scrollbar{scrollbar-width:thin;scrollbar-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))     var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar{height:var(--rtk-space-1\\.5, 6px);width:var(--rtk-space-1\\.5, 6px);border-radius:9999px;background-color:var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar-thumb{border-radius:9999px;background-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))}:host{position:relative;height:100%;width:100%;box-sizing:border-box}.content{position:relative;display:flex;height:100%;width:100%;flex-direction:column;overflow-y:auto}.waitlist-area{display:flex;flex-direction:column;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity))}.listening-title{text-align:center;margin-top:var(--rtk-space-5, 20px);margin-bottom:var(--rtk-space-4, 16px)}.waitlist-grid{flex:1 1 0%}.grid{box-sizing:border-box;flex:1 1 0%;gap:var(--rtk-space-6, 24px);display:flex;align-content:center;justify-content:center;flex-wrap:wrap}:host([size='md']) .grid{gap:var(--rtk-space-4, 16px)}:host([size='sm']) .grid{gap:var(--rtk-space-3, 12px)}rtk-audio-tile{aspect-ratio:1 / 1;flex:none;width:calc(20%);max-width:var(--rtk-space-48, 192px);transition:all 0.3s}rtk-audio-tile[size='md']{width:100%;max-width:var(--rtk-space-36, 144px)}rtk-audio-tile[size='sm']{width:100%;max-width:var(--rtk-space-24, 96px)}`;

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
const RtkAudioGrid = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** Icon Pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        /** Whether to hide self in the grid */
        this.hideSelf = false;
        this.activeParticipants = [];
        this.onStageParticipants = [];
        this.offStageParticipants = [];
        this.onParticipantListUpdate = () => {
            if (!this.meeting) {
                return;
            }
            let activeParticipants = this.meeting.participants.active.toArray();
            if (!this.hideSelf) {
                activeParticipants = [...activeParticipants, this.meeting.self];
            }
            let onStageParticipants = this.meeting.participants.joined
                .toArray()
                .filter((p) => !activeParticipants.some((a) => a.id === p.id));
            this.activeParticipants = activeParticipants;
            this.onStageParticipants = onStageParticipants;
        };
    }
    connectedCallback() {
        this.meetingChanged(this.meeting);
    }
    meetingChanged(meeting) {
        if (!meeting || meeting.self.config.viewType !== 'AUDIO_ROOM') {
            return;
        }
        this.onParticipantListUpdate();
        // listeners
        meeting.participants.active.addListener('participantJoined', this.onParticipantListUpdate);
        meeting.participants.active.addListener('participantLeft', this.onParticipantListUpdate);
        meeting.participants.joined.addListener('participantJoined', this.onParticipantListUpdate);
        meeting.participants.joined.addListener('participantLeft', this.onParticipantListUpdate);
    }
    disconnectedCallback() {
        this.resizeObserver.disconnect();
        this.resizeObserver = undefined;
        this.meeting.participants.active.removeListener('participantJoined', this.onParticipantListUpdate);
        this.meeting.participants.active.removeListener('participantLeft', this.onParticipantListUpdate);
        this.meeting.participants.joined.removeListener('participantJoined', this.onParticipantListUpdate);
        this.meeting.participants.joined.removeListener('participantLeft', this.onParticipantListUpdate);
    }
    renderGrid(participants = []) {
        const defaults = {
            meeting: this.meeting,
            size: this.size,
            config: this.config,
            t: this.t,
            iconPack: this.iconPack,
            states: this.states,
        };
        return participants.map((participant) => {
            return (h(Render, { element: "rtk-audio-tile", defaults: defaults, props: {
                    key: participant.id,
                    participant,
                }, childProps: {
                    participant,
                }, deepProps: true }));
        });
    }
    render() {
        const onStage = this.activeParticipants.concat(this.onStageParticipants);
        return (h(Host, { key: '46eacac44f967fdac3ca9d1a62ffa08a9e2bec0e' }, h("div", { key: '6121a8d6ec144197981ced909076345163f0fa69', class: "content scrollbar" }, h("div", { key: 'caeb7f4830e847e7dab63db199ec00cd12cb8ecc', class: "stage grid" }, this.renderGrid(onStage)), this.offStageParticipants.length > 0 && (h("div", { key: 'b5923cbb9be5992fdb007c3354e7792b19003d5b', class: "waitlist-area" }, h("div", { key: 'b93cefbe7de0eaf46c69f9d0dd6cf231ce683f27', class: "listening-title" }, this.offStageParticipants.length, " ", this.t('grid.listening')), h("div", { key: 'f75c7cd4aa2422d3faed994ed24929e3c05fd097', class: "waitlist-grid grid" }, this.renderGrid(this.offStageParticipants))))), h("slot", { key: '91240e462e7e510317b0ea6625ecba3aea94d5f3' })));
    }
    get host() { return getElement(this); }
    static get watchers() { return {
        "meeting": [{
                "meetingChanged": 0
            }]
    }; }
};
__decorate([
    SyncWithStore()
], RtkAudioGrid.prototype, "meeting", void 0);
__decorate([
    SyncWithStore()
], RtkAudioGrid.prototype, "config", void 0);
__decorate([
    SyncWithStore()
], RtkAudioGrid.prototype, "states", void 0);
__decorate([
    SyncWithStore()
], RtkAudioGrid.prototype, "iconPack", void 0);
__decorate([
    SyncWithStore()
], RtkAudioGrid.prototype, "t", void 0);
RtkAudioGrid.style = rtkAudioGridCss();

export { RtkAudioGrid as rtk_audio_grid };
