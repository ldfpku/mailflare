import { r as registerInstance, h, a as Host } from './index-gJCRRBX0.js';
import { e as defaultIconPack } from './ui-store-CkvSNsmd.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';

const rtkClockCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{display:inline-flex;align-items:center;-webkit-user-select:none;-moz-user-select:none;user-select:none;font-size:14px;color:rgb(var(--rtk-colors-text-1000, 255 255 255));font-variant-numeric:tabular-nums}:host([data-hidden]){display:none}:host([size='sm']){font-size:12px}rtk-icon{margin-right:var(--rtk-space-1, 4px);height:var(--rtk-space-5, 20px);width:var(--rtk-space-5, 20px)}:host([size='sm']) rtk-icon{height:var(--rtk-space-4, 16px);width:var(--rtk-space-4, 16px)}`;

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
const addZero = (n) => Math.trunc(n).toString().padStart(2, '0');
const RtkClock = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** Icon pack */
        this.iconPack = defaultIconPack;
        this.disconnectMeeting = () => {
            var _a, _b;
            this.timeout && clearTimeout(this.timeout);
            typeof this.request === 'number' && cancelAnimationFrame(this.request);
            (_b = (_a = this.meeting) === null || _a === void 0 ? void 0 : _a.meta) === null || _b === void 0 ? void 0 : _b.removeListener('meetingStartTimeUpdate', this.startedTimeUpdateListener);
        };
        this.startedTimeUpdateListener = () => {
            var _a, _b, _c;
            this.startedTime = (_c = (_b = (_a = this.meeting) === null || _a === void 0 ? void 0 : _a.meta) === null || _b === void 0 ? void 0 : _b.meetingStartedTimestamp) === null || _c === void 0 ? void 0 : _c.toISOString();
        };
    }
    connectedCallback() {
        this.meetingChanged(this.meeting);
    }
    disconnectedCallback() {
        this.disconnectMeeting();
    }
    meetingChanged(meeting) {
        var _a, _b, _c;
        this.disconnectMeeting();
        if (meeting != null) {
            this.startedTime = (_b = (_a = meeting.meta) === null || _a === void 0 ? void 0 : _a.meetingStartedTimestamp) === null || _b === void 0 ? void 0 : _b.toISOString();
            (_c = meeting.meta) === null || _c === void 0 ? void 0 : _c.addListener('meetingStartTimeUpdate', this.startedTimeUpdateListener);
        }
    }
    startedTimeChanged(startedTime) {
        if (startedTime !== undefined) {
            const animate = () => {
                this.timeDiff = (Date.now() - new Date(this.startedTime).getTime()) / 1000;
                this.timeout = setTimeout(() => {
                    if (this.request != null) {
                        this.request = requestAnimationFrame(animate);
                    }
                }, 500);
            };
            this.request = requestAnimationFrame(animate);
        }
    }
    getFormattedTime() {
        if (this.timeDiff == null) {
            return null;
        }
        const diff = this.timeDiff;
        let time = '';
        if (diff >= 3600) {
            time = `${addZero(diff / 3600)}:`;
        }
        time += `${addZero((diff % 3600) / 60)}:${addZero(diff % 60)}`;
        return time;
    }
    render() {
        const showClock = this.startedTime !== undefined;
        return (h(Host, { key: '4592c92b870075a8ec23d89c01c382f61278983a', "data-hidden": !showClock, tabIndex: 0, role: "timer", "aria-live": "off" }, this.startedTime !== undefined && [
            h("rtk-icon", { key: '87b1012dd7c5d7187182a2ed025868f05ed010e7', icon: this.iconPack.clock, "aria-hidden": true, tabIndex: -1, part: "icon" }),
            h("span", { key: '6fec2fef30be9c54a3e68108fde81a59ce000576', part: "text" }, this.getFormattedTime()),
        ]));
    }
    static get watchers() { return {
        "meeting": [{
                "meetingChanged": 0
            }],
        "startedTime": [{
                "startedTimeChanged": 0
            }]
    }; }
};
__decorate([
    SyncWithStore()
], RtkClock.prototype, "meeting", void 0);
__decorate([
    SyncWithStore()
], RtkClock.prototype, "iconPack", void 0);
RtkClock.style = rtkClockCss();

export { RtkClock as rtk_clock };
