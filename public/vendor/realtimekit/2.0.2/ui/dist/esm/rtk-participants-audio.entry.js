import { r as registerInstance, d as createEvent, h, a as Host } from './index-gJCRRBX0.js';
import { i as isFirefox } from './browser-CAqYddlg.js';
import { e as defaultIconPack, i as useLanguage } from './ui-store-CkvSNsmd.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';
import { a as isLiveStreamViewer } from './livestream-C0vp-Q7v.js';

/**
 * Handles audio from participants in a meeting
 */
class RTKAudio {
    constructor(meeting, audio) {
        this.meeting = meeting;
        this.audio = audio !== null && audio !== void 0 ? audio : document.createElement('audio');
        this.audio.autoplay = true;
        this.logger = meeting.__internals__.logger;
        this.audioStream = new MediaStream();
        this.audio.srcObject = this.audioStream;
        this.audioTracks = [];
    }
    addTrack(id, track) {
        // Remove the track if it already exists, with the same id
        this.removeTrack(id);
        this.audioTracks.push({ id, track });
        this.audioStream.addTrack(track);
        this.play();
    }
    removeTrack(id) {
        const track = this.audioTracks.find((a) => a.id === id);
        if (track != null) {
            this.audioStream.removeTrack(track.track);
            this.audioTracks = this.audioTracks.filter((a) => a.id !== id);
        }
    }
    async play() {
        var _a;
        this.audio.srcObject = this.audioStream;
        await ((_a = this.audio.play()) === null || _a === void 0 ? void 0 : _a.catch((err) => {
            if (err.name === 'NotAllowedError') {
                if (this._onError != null) {
                    this._onError();
                }
            }
            else if (err.name !== 'AbortError') {
                this.logger.error('[rtk-audio] play() error\n', err);
            }
        }));
    }
    async setDevice(id) {
        var _a, _b, _c;
        if (isFirefox(this.meeting))
            return;
        await ((_c = (_b = (_a = this.audio).setSinkId) === null || _b === void 0 ? void 0 : _b.call(_a, id)) === null || _c === void 0 ? void 0 : _c.catch((err) => {
            this.logger.error('[rtk-audio] setSinkId() error\n', err);
        }));
    }
    onError(onError) {
        this._onError = onError;
    }
}

const rtkParticipantsAudioCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{display:block;overflow-wrap:break-word;color:rgb(var(--rtk-colors-text-1000, 255 255 255));word-wrap:break-word}.modal{box-sizing:border-box;width:100%;max-width:var(--rtk-space-96, 384px);padding:var(--rtk-space-4, 16px);border-radius:var(--rtk-border-radius-md, 8px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity))}.modal h3{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px);font-size:24px;font-weight:500}.modal p{margin-top:var(--rtk-space-4, 16px);margin-bottom:var(--rtk-space-6, 24px)}.modal rtk-button{width:100%}`;

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
const RtkParticipantsAudio = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.dialogClose = createEvent(this, "dialogClose", 7);
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        /** Pass existing audio element */
        this.preloadedAudioElem = undefined;
        this.showPlayDialog = false;
        this.onRtkDialogClose = () => {
            this.showPlayDialog = false;
            this.dialogClose.emit();
        };
    }
    componentDidLoad() {
        this.meetingChanged(this.meeting);
    }
    disconnectedCallback() {
        var _a;
        if (!this.meeting)
            return;
        this.audioUpdateListener &&
            this.meeting.participants.joined.removeListener('audioUpdate', this.audioUpdateListener);
        this.screenShareUpdateListener &&
            this.meeting.participants.joined.removeListener('screenShareUpdate', this.screenShareUpdateListener);
        this.participantLeftListener &&
            this.meeting.participants.joined.removeListener('participantLeft', this.participantLeftListener);
        this.deviceUpdateListener &&
            this.meeting.self.removeListener('deviceUpdate', this.deviceUpdateListener);
        this.stageStatusUpdateListener &&
            ((_a = this.meeting.stage) === null || _a === void 0 ? void 0 : _a.removeListener('stageStatusUpdate', this.stageStatusUpdateListener));
    }
    async setupAudio() {
        this.audio = new RTKAudio(this.meeting, this.preloadedAudioElem);
        // Set the device to the current speaker device
        const currentDevices = this.meeting.self.getCurrentDevices();
        if (currentDevices.speaker != null) {
            await this.audio.setDevice(currentDevices.speaker.deviceId);
        }
    }
    async handleAutoPlayError() {
        if (!this.audio) {
            await this.setupAudio();
        }
        this.audio.onError(() => {
            this.showPlayDialog = true;
        });
        this.audio.play();
        return;
    }
    async handleEvents(meeting) {
        this.audioUpdateListener = ({ id, audioEnabled, audioTrack }) => {
            const audioId = `audio-${id}`;
            if (audioEnabled && audioTrack != null) {
                this.audio.addTrack(audioId, audioTrack);
            }
            else {
                this.audio.removeTrack(audioId);
            }
        };
        const participants = meeting.participants.joined.toArray();
        for (const participant of participants) {
            this.audioUpdateListener(participant);
        }
        this.participantLeftListener = ({ id }) => {
            this.audio.removeTrack(`audio-${id}`);
            this.audio.removeTrack(`screenshare-${id}`);
        };
        this.screenShareUpdateListener = ({ id, screenShareEnabled, screenShareTracks }) => {
            const audioId = `screenshare-${id}`;
            if (screenShareEnabled && screenShareTracks.audio != null) {
                this.audio.addTrack(audioId, screenShareTracks.audio);
            }
            else {
                this.audio.removeTrack(audioId);
            }
        };
        this.deviceUpdateListener = ({ device, preview }) => {
            if (preview)
                return;
            if (device.kind === 'audiooutput') {
                this.audio.setDevice(device.deviceId);
            }
        };
        meeting.participants.joined.addListener('audioUpdate', this.audioUpdateListener);
        meeting.participants.joined.addListener('screenShareUpdate', this.screenShareUpdateListener);
        meeting.participants.joined.addListener('participantLeft', this.participantLeftListener);
        meeting.self.addListener('deviceUpdate', this.deviceUpdateListener);
    }
    async meetingChanged(meeting) {
        var _a;
        if (!meeting)
            return;
        this.setupAudio();
        if (isLiveStreamViewer(meeting)) {
            this.stageStatusUpdateListener = async (status) => {
                if (status === 'ON_STAGE') {
                    // NOTE(@madhugb): When someone joins stage handle autoplay and also handle events
                    await this.handleAutoPlayError();
                }
            };
            (_a = meeting.stage) === null || _a === void 0 ? void 0 : _a.on('stageStatusUpdate', this.stageStatusUpdateListener);
        }
        else {
            await this.handleAutoPlayError();
        }
        await this.handleEvents(meeting);
    }
    render() {
        return (h(Host, { key: '14ddae0562633e4433788c18fb89533248df6c2b' }, this.showPlayDialog && (h("rtk-dialog", { key: 'd0e33058fbcd77861009ce80d7d4e29b2b597475', open: true, onRtkDialogClose: this.onRtkDialogClose, hideCloseButton: true, disableEscapeKey: true, iconPack: this.iconPack, t: this.t }, h("div", { key: 'e6a9a18c1eaf3e09d13e25373982183b3ad6f8ec', class: "modal" }, h("h3", { key: 'bc87cc408aad7117cc8d808e38142b3801e5ff53' }, this.t('audio_playback.title')), h("p", { key: 'b1927a5cd053c59e19a6c4c54044ca500691ee71' }, this.t('audio_playback.description')), h("rtk-button", { key: '3c022bb0602295cbd5996ae2ee066e254b1af2fb', kind: "wide", onClick: () => {
                this.audio.play();
                this.onRtkDialogClose();
            }, title: this.t('audio_playback') }, this.t('audio_playback')))))));
    }
    static get watchers() { return {
        "meeting": [{
                "meetingChanged": 0
            }]
    }; }
};
__decorate([
    SyncWithStore()
], RtkParticipantsAudio.prototype, "meeting", void 0);
__decorate([
    SyncWithStore()
], RtkParticipantsAudio.prototype, "iconPack", void 0);
__decorate([
    SyncWithStore()
], RtkParticipantsAudio.prototype, "t", void 0);
RtkParticipantsAudio.style = rtkParticipantsAudioCss();

export { RtkParticipantsAudio as rtk_participants_audio };
