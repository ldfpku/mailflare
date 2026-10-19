import { r as registerInstance, h, a as Host } from './index-gJCRRBX0.js';
import { e as defaultIconPack, i as useLanguage, J as clone } from './ui-store-CkvSNsmd.js';
import { C as ChatHead } from './ChatHead-BV_pLIJ6.js';
import { s as smoothScrollToBottom } from './scroll-BIplIdLH.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';
import './date-jvwnrxra.js';
import './string-vBD2htwQ.js';

const rtkAiTranscriptionsCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}.head{display:flex;align-items:center}.head .name{margin-right:var(--rtk-space-4, 16px);font-size:12px;font-weight:700}.head .time{font-size:12px;color:rgb(var(--rtk-colors-text-800, 255 255 255 / 0.76))}.scrollbar{scrollbar-width:thin;scrollbar-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))     var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar{height:var(--rtk-space-1\\.5, 6px);width:var(--rtk-space-1\\.5, 6px);border-radius:9999px;background-color:var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar-thumb{border-radius:9999px;background-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))}*{box-sizing:border-box;border-width:0;border-style:solid}:host{width:100%;display:flex;flex-direction:column}.processing{display:flex;flex:1 1 0%;flex-direction:column;align-items:center;justify-content:center}.content{box-sizing:border-box;display:flex;flex-direction:column;padding:var(--rtk-space-3, 12px);flex:1 0 0px;overflow-y:scroll}.started-message{margin-top:var(--rtk-space-5, 20px);margin-bottom:var(--rtk-space-5, 20px);text-align:center;font-size:12px;color:rgb(var(--rtk-colors-text-700, 255 255 255 / 0.64))}.search{position:sticky;box-sizing:border-box;display:flex;align-items:center;border-radius:var(--rtk-border-radius-sm, 4px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity));margin-left:var(--rtk-space-3, 12px);margin-right:var(--rtk-space-3, 12px);margin-top:var(--rtk-space-4, 16px);margin-bottom:var(--rtk-space-4, 16px)}.search rtk-icon{margin-left:var(--rtk-space-2, 8px);margin-right:var(--rtk-space-2, 8px);height:var(--rtk-space-5, 20px);width:var(--rtk-space-5, 20px);color:rgb(var(--rtk-colors-text-600, 255 255 255 / 0.52))}.search input{box-sizing:border-box;height:var(--rtk-space-9, 36px);width:100%;padding-right:var(--rtk-space-2, 8px);border-width:var(--rtk-border-width-none, 0);border-style:none;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-1000, 255 255 255));outline:2px solid transparent;outline-offset:2px;border-radius:var(--rtk-border-radius-sm, 4px);font-size:14px}.search input::-moz-placeholder{color:rgb(var(--rtk-colors-text-800, 255 255 255 / 0.76))}.search input::placeholder{color:rgb(var(--rtk-colors-text-800, 255 255 255 / 0.76))}.caption-view{height:var(--rtk-space-12, 48px);width:100%;padding-left:var(--rtk-space-3, 12px);padding-right:var(--rtk-space-3, 12px);padding-top:var(--rtk-space-3, 12px);padding-bottom:var(--rtk-space-3, 12px);border-bottom-width:var(--rtk-border-width-sm, 1px);border-style:solid;--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-border-opacity));display:flex;align-items:center;justify-content:space-between;font-size:14px}.message .body{margin-top:var(--rtk-space-2, 8px);margin-bottom:var(--rtk-space-2, 8px);font-size:14px;word-break:break-word}.message{margin-bottom:var(--rtk-space-3, 12px)}.message:last-child{margin-bottom:var(--rtk-space-0, 0px)}`;

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
const RtkAiTranscriptions = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.searchQuery = '';
        this.isProcessing = false;
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.transcriptions = [];
        this.autoScrollEnabled = true;
        this.onScroll = (e) => {
            const { scrollTop, clientHeight, scrollHeight } = e.target;
            const fromTop = scrollTop + clientHeight;
            if (fromTop + 10 >= scrollHeight) {
                // at bottom
                this.autoScrollEnabled = true;
            }
            else {
                // not at bottom
                this.autoScrollEnabled = false;
            }
        };
        this.onTranscriptHandler = (data) => {
            this.transcriptions = this.transcriptionsReducer(this.transcriptions, data);
        };
    }
    // private transcriptionHandler(data: Transcript) {
    //   this.transcriptions = [...this.transcriptions, data];
    // }
    transcriptionsReducer(acc, t) {
        if (!acc.length || acc[acc.length - 1].peerId !== t.peerId) {
            return acc.concat(t);
        }
        const lastElement = acc[acc.length - 1];
        if (lastElement.id === t.id) {
            lastElement.transcript = t.transcript;
            acc.pop();
            return acc.concat(lastElement);
        }
        return acc.concat(t);
    }
    connectedCallback() {
        if (!this.meeting)
            return;
        this.meetingChanged(this.meeting);
    }
    componentDidLoad() {
        var _a;
        (_a = this.contentContainer) === null || _a === void 0 ? void 0 : _a.addEventListener('scroll', this.onScroll);
    }
    disconnectedCallback() {
        var _a, _b, _c;
        (_b = (_a = this.meeting) === null || _a === void 0 ? void 0 : _a.ai) === null || _b === void 0 ? void 0 : _b.off('transcript', this.onTranscriptHandler);
        (_c = this.contentContainer) === null || _c === void 0 ? void 0 : _c.removeEventListener('scroll', this.onScroll);
    }
    meetingChanged(meeting) {
        var _a, _b;
        this.transcriptions = clone((_a = meeting === null || meeting === void 0 ? void 0 : meeting.ai) === null || _a === void 0 ? void 0 : _a.transcripts);
        this.transcriptions = this.transcriptions.reduce(this.transcriptionsReducer, []);
        (_b = meeting === null || meeting === void 0 ? void 0 : meeting.ai) === null || _b === void 0 ? void 0 : _b.on('transcript', this.onTranscriptHandler);
    }
    transcriptionsChanged() {
        if (this.autoScrollEnabled) {
            setTimeout(() => {
                smoothScrollToBottom(this.contentContainer, false);
            }, 100);
        }
    }
    renderContent() {
        const transcripts = this.renderTranscripts();
        return (h("div", { class: "content scrollbar", ref: (el) => (this.contentContainer = el) }, this.transcriptions.length === 0 && (h("div", { class: "started-message" }, this.t('ai.transcriptions.no_transcripts_yet'))), transcripts, this.transcriptions.length > 0 && this.searchQuery && transcripts.length === 0 && (h("div", { class: "started-message" }, this.t('ai.transcriptions.no_transcripts_found')))));
    }
    renderTranscripts() {
        var _a;
        const query = (_a = this.searchQuery) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        const transcripts = this.transcriptions.filter((t) => {
            var _a, _b;
            return query
                ? ((_a = t.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(query)) || ((_b = t.transcript) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(query))
                : true;
        });
        const renderedTranscripts = [];
        transcripts.forEach((transcript) => {
            const t = {
                name: transcript.name,
                date: transcript.date,
                peerId: transcript.peerId,
                transcript: transcript.transcript,
            };
            if (!renderedTranscripts.length) {
                renderedTranscripts.push(t);
                return;
            }
            const lastTranscript = renderedTranscripts[renderedTranscripts.length - 1];
            if (transcript.peerId !== lastTranscript.peerId) {
                renderedTranscripts.push(t);
                return;
            }
            lastTranscript.transcript += ' ' + transcript.transcript;
        });
        return renderedTranscripts.map((transcription) => {
            return (h("div", { class: "message" }, h(ChatHead, { name: transcription.name, time: new Date(transcription.date), now: new Date() }), h("div", { class: "body" }, transcription.transcript)));
        });
    }
    render() {
        return (h(Host, { key: '08b41c4274270f9df80881c0a1fee9cdb5621ed7' }, h("div", { key: 'debebf0ef34437b1d9266cf5470a3d47975a865b', class: "search" }, h("rtk-icon", { key: '5a17bcacd6ee1813ca40f5d6d550cc7425060d14', icon: this.iconPack.search }), h("input", { key: 'b36d618edaccca47d5a076bf28e2af4c08039929', type: "search", autocomplete: "off", placeholder: this.t('ai.transcriptions.search_placeholder'), value: this.searchQuery, onInput: (e) => (this.searchQuery = e.target.value) })), this.isProcessing && (h("div", { key: '8a9a5fda23dec97e14faaacc6bbade22a711b137', class: "processing" }, h("p", { key: '24385d63e55281e957bed28b5055560b9a860c63' }, "Processing audio...."))), !this.isProcessing && this.renderContent()));
    }
    static get watchers() { return {
        "meeting": [{
                "meetingChanged": 0
            }],
        "transcriptions": [{
                "transcriptionsChanged": 0
            }]
    }; }
};
__decorate([
    SyncWithStore()
], RtkAiTranscriptions.prototype, "meeting", void 0);
__decorate([
    SyncWithStore()
], RtkAiTranscriptions.prototype, "iconPack", void 0);
__decorate([
    SyncWithStore()
], RtkAiTranscriptions.prototype, "t", void 0);
RtkAiTranscriptions.style = rtkAiTranscriptionsCss();

export { RtkAiTranscriptions as rtk_ai_transcriptions };
