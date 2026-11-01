import { useEffect, useRef, useState } from "react";

export function useMessageContentScroll(messageId: string, loading: boolean) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // 外部系统同步（DOM 测量）：消息或加载态变化后读取滚动容器的 scrollTop，据此同步是否已滚动的状态。
    // eslint-disable-next-line react/set-state-in-effect
    setScrolled((scrollRef.current?.scrollTop ?? 0) > 0);
  }, [messageId, loading]);

  useEffect(() => {
    // 外部系统同步（DOM 操作）：切换邮件时把滚动容器复位到顶部，并同步重置「已滚动」状态。
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    // eslint-disable-next-line react/set-state-in-effect
    setScrolled(false);
  }, [messageId]);

  function handleScroll() {
    setScrolled((scrollRef.current?.scrollTop ?? 0) > 0);
  }

  return { scrollRef, scrolled, handleScroll };
}
