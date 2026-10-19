import { h } from './index-gJCRRBX0.js';
import { f as formatDateTime, e as elapsedDuration } from './date-jvwnrxra.js';
import { a as shorten, f as formatName } from './string-vBD2htwQ.js';

const ChatHead = ({ name, time, now }) => {
    return (h("div", { class: "head" }, h("div", { class: "name" }, shorten(formatName(name), 20)), h("div", { class: "time", title: formatDateTime(time) }, elapsedDuration(time, now))));
};

export { ChatHead as C };
