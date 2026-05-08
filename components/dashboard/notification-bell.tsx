"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, Trash2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getActivityDeepLink, getFilteredNotifications, markNotificationAsRead } from "@/app/actions";
import { useRouter } from "next/navigation";
import { getPriorityBadgeClass, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { RealtimeNotificationPayload } from "@/lib/realtime/notifications-events";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  category: string | null;
  functionalArea: string | null;
  createdAt: Date | string;
  activityId: string | null;
  activity?: {
    id: string;
    title: string;
    project: { name: string };
    collaborator: { firstName: string; firstSurname: string } | null;
  } | null;
}

function getAccidentalidadHighlightFromMessage(message: string) {
  const match = message.match(/\[ACC:([^\]]+)\]/);
  return match?.[1] || null;
}

function stripInternalRefs(message: string) {
  return message.replace(/\s*\[ACC:[^\]]+\]\s*/g, " ").replace(/\s+/g, " ").trim();
}

function timeAgo(date: Date | string) {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " años";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " meses";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " días";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " horas";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutos";
  return Math.floor(seconds) + " segundos";
}

export function NotificationBell(props: { userRole: string }) {
  const [mounted, setMounted] = useState(false);
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(max-width: 1023px)").matches;
  });
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  const prevCountRef = useRef(0);
  const isFirstLoadRef = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const router = useRouter();

  // Load sound preference from local storage
  useEffect(() => {
    const savedSound = localStorage.getItem("notificationSoundEnabled");
    if (savedSound !== null) {
      setIsSoundEnabled(savedSound === "true");
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isSoundEnabled) return;
    if (audioUnlocked) return;

    const tryUnlock = () => {
      void unlockAudio();
    };

    window.addEventListener("pointerdown", tryUnlock, { once: true });
    window.addEventListener("keydown", tryUnlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", tryUnlock);
      window.removeEventListener("keydown", tryUnlock);
    };
  }, [audioUnlocked, isSoundEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (audioRef.current) return;
    const audio = new Audio("/mp3/tono.mp3");
    audio.preload = "auto";
    audio.volume = 0.5;
    audioRef.current = audio;
  }, []);

  const getAudioContext = () => {
    if (typeof window === "undefined") return null;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new Ctx();
    }
    return audioCtxRef.current;
  };

  const playBeep = async () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return false;
      if (ctx.state === "suspended") await ctx.resume();
      const gain = ctx.createGain();
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.12;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
      return true;
    } catch (error) {
      console.warn("WebAudio beep failed:", error);
      return false;
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(max-width: 1023px)");
    const apply = () => setIsCompact(media.matches);
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const toggleSound = () => {
    const newState = !isSoundEnabled;
    setIsSoundEnabled(newState);
    localStorage.setItem("notificationSoundEnabled", String(newState));
    
    if (newState) {
      // iOS requires a user gesture to unlock audio.
      void unlockAudio()
        .then((unlocked) => (unlocked ? playNotificationSound(true) : false))
        .then((ok) => {
        if (ok) {
          toast.success("Sonido de notificaciones activado");
        } else {
          toast.info("Sonido activado, pero iOS puede bloquearlo.", {
            description:
              "Asegúrese de que Safari no esté en modo silencio y permita reproducción de audio.",
            duration: 7000,
          });
        }
      });
    } else {
      toast.info("Sonido de notificaciones desactivado");
    }
  };

  const unlockAudio = async () => {
    let ok = false;
    try {
      const audio = audioRef.current ?? new Audio("/mp3/tono.mp3");
      audioRef.current = audio;
      audio.preload = "auto";
      audio.volume = 0.5;
      audio.currentTime = 0;
      audio.muted = true;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      ok = true;
    } catch (error) {
      console.warn("HTMLAudio unlock failed:", error);
    }
    try {
      const ctx = getAudioContext();
      if (ctx) {
        if (ctx.state === "suspended") await ctx.resume();
        ok = true;
      }
    } catch (error) {
      console.warn("AudioContext unlock failed:", error);
    }
    setAudioUnlocked(ok);
    return ok;
  };

  const playNotificationSound = async (force = false) => {
    if (!isSoundEnabled && !force) return false;
    if (!audioUnlocked && !force) return false;

    try {
      const audio = audioRef.current ?? new Audio("/mp3/tono.mp3");
      audio.volume = 0.5;
      audio.currentTime = 0;
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        await playPromise;
      }
      if (force) setAudioUnlocked(true);
      return true;
    } catch (error) {
      console.warn("HTMLAudio play failed:", error);
      const ok = await playBeep();
      if (force) setAudioUnlocked(ok);
      return ok;
    }
  };

  const fetchData = async () => {
    try {
      const result = await getFilteredNotifications({ limit: 20 });
      if (result.success && result.notifications) {
        setNotifications(result.notifications as unknown as Notification[]);
        setCount(result.notifications.length);
      }
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    }
  };

  // Watch for count changes to play sound
  useEffect(() => {
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      prevCountRef.current = count;
      return;
    }

    if (count > prevCountRef.current) {
      void playNotificationSound();
    }
    
    prevCountRef.current = count;
  }, [count]);

  useEffect(() => {
    fetchData();

    let es: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let tries = 0;

    const connect = () => {
      if (typeof EventSource === "undefined") return;
      es?.close();
      es = new EventSource("/api/realtime/notifications");
      es.addEventListener("notification_created", (evt: MessageEvent) => {
        try {
          const payload = JSON.parse(evt.data) as RealtimeNotificationPayload;
          const next: Notification = {
            id: payload.id,
            title: payload.title,
            message: payload.message,
            type: payload.type,
            priority: payload.priority,
            category: payload.category,
            functionalArea: payload.functionalArea,
            createdAt: payload.createdAt,
            activityId: payload.activityId,
            activity: null,
          };
          setNotifications((prev) => [next, ...prev].slice(0, 20));
          setCount((prev) => prev + 1);
        } catch {
        }
      });
      es.addEventListener("error", () => {
        es?.close();
        if (reconnectTimer) return;
        const retry = Math.min(tries, 6);
        const delay = 500 * Math.pow(2, retry);
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          tries += 1;
          connect();
        }, delay);
      });
    };

    connect();

    // Keep polling as fallback but less frequently (60s)
    const interval = setInterval(fetchData, 60000);
    
    return () => {
      clearInterval(interval);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      es?.close();
    };
  }, []);

  const handleNotificationClick = async (notification: Notification) => {
    setMenuOpen(false);
    setOpenSwipeId(null);
    try {
      await markNotificationAsRead(notification.id);
      // Optimistically update UI
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      setCount((prev) => Math.max(0, prev - 1));

      const isAdmin = props.userRole === "ADMIN_PMD" || props.userRole === "GESTOR";
      const isClient = props.userRole === "CLIENT" || props.userRole === "CLIENT_VIEWER";
      const statusParam = notification.type === "ACTIVITY_RETURNED" ? "REJECTED" : "IN_REVIEW";
      const highlight =
        notification.activityId || getAccidentalidadHighlightFromMessage(notification.message);

      const target = highlight
        ? `/activities?status=${statusParam}&highlight=${highlight}`
        : `/activities?status=${statusParam}`;

      if (isClient) {
        if (!notification.activityId) return;
        const res = await getActivityDeepLink(notification.activityId);
        if (!res.success) {
          toast.error(res.error || "No se pudo abrir la actividad.");
          return;
        }
        router.push(res.url);
        return;
      }
      if (!isAdmin && props.userRole !== "CONSULTANT") return;

      router.push(target);
    } catch (error) {
      console.error("Failed to process notification click", error);
    }
  };

  const handleNotificationDismiss = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setCount((prev) => Math.max(0, prev - 1));
      setOpenSwipeId((prev) => (prev === notificationId ? null : prev));
      toast.success("Notificación eliminada");
    } catch (error) {
      console.error("Failed to dismiss notification", error);
      toast.error("No se pudo eliminar la notificación");
    }
  };

  const getPriorityLabel = (priority: string) => {
    const p = priority.toLowerCase();
    if (p === "high" || p === "alta" || p === "critical") return "ALTA";
    if (p === "medium" || p === "media") return "MEDIA";
    return "BAJA";
  };

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="relative text-zinc-400 hover:text-accent"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5" />
      </Button>
    );
  }

  const SWIPE_ACTION_WIDTH = 104;

  const SwipeableNotificationItem = ({ notification }: { notification: Notification }) => {
    const isOpen = openSwipeId === notification.id;
    const [offsetX, setOffsetX] = useState(isOpen ? -SWIPE_ACTION_WIDTH : 0);
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const startYRef = useRef(0);
    const baseOffsetRef = useRef(0);
    const suppressSelectRef = useRef(false);
    const lastWasDragRef = useRef(false);

    useEffect(() => {
      if (isDraggingRef.current) return;
      setOffsetX(isOpen ? -SWIPE_ACTION_WIDTH : 0);
    }, [isOpen]);

    const finishGesture = async () => {
      if (!isDraggingRef.current) return;

      const shouldDismiss = offsetX <= -SWIPE_ACTION_WIDTH * 1.25;
      if (shouldDismiss) {
        setOffsetX(-SWIPE_ACTION_WIDTH * 1.6);
        await handleNotificationDismiss(notification.id);
        isDraggingRef.current = false;
        lastWasDragRef.current = true;
        return;
      }

      const shouldOpen = offsetX <= -SWIPE_ACTION_WIDTH * 0.55;
      if (shouldOpen) {
        setOpenSwipeId(notification.id);
        setOffsetX(-SWIPE_ACTION_WIDTH);
      } else {
        setOpenSwipeId(null);
        setOffsetX(0);
      }
      isDraggingRef.current = false;
      lastWasDragRef.current = true;
    };

    const onTouchStart = (e: React.TouchEvent) => {
      if (!isCompact) return;
      const t = e.touches[0];
      if (!t) return;
      startXRef.current = t.clientX;
      startYRef.current = t.clientY;
      baseOffsetRef.current = isOpen ? -SWIPE_ACTION_WIDTH : 0;
      isDraggingRef.current = false;
      suppressSelectRef.current = false;
      lastWasDragRef.current = false;
    };

    const onTouchMove = (e: React.TouchEvent) => {
      if (!isCompact) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startXRef.current;
      const dy = t.clientY - startYRef.current;

      if (!isDraggingRef.current) {
        const horizontal = Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) + 4;
        if (!horizontal) return;
        isDraggingRef.current = true;
        suppressSelectRef.current = true;
        setOpenSwipeId(notification.id);
      }

      e.preventDefault();
      const next = Math.max(-SWIPE_ACTION_WIDTH * 1.6, Math.min(0, baseOffsetRef.current + dx));
      setOffsetX(next);
    };

    const onTouchEnd = async () => {
      if (!isCompact) return;
      await finishGesture();
    };

    const onTouchCancel = () => {
      if (!isCompact) return;
      if (!isDraggingRef.current) return;
      setOpenSwipeId(null);
      setOffsetX(0);
      isDraggingRef.current = false;
      lastWasDragRef.current = true;
    };

    const onSelect = (e: Event) => {
      if (!isCompact) return;
      e.preventDefault();
    };

    const onClick = async () => {
      if (!isCompact) {
        await handleNotificationClick(notification);
        return;
      }
      if (isDraggingRef.current || lastWasDragRef.current) return;
      if (isOpen) {
        setOpenSwipeId(null);
        setOffsetX(0);
        return;
      }
      await handleNotificationClick(notification);
    };

    return (
      <DropdownMenuItem
        key={notification.id}
        className="p-0 focus:bg-transparent"
        onSelect={onSelect}
      >
        <div className="relative w-full overflow-hidden rounded-md">
          <div className="absolute inset-0 flex items-center justify-end bg-red-600 pr-3">
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-700 px-3 text-sm font-semibold text-white"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleNotificationDismiss(notification.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </button>
          </div>

          <div
            className={cn(
              "cursor-pointer select-none",
              "flex flex-col items-start gap-2 p-3 border-b last:border-0 border-zinc-100 dark:border-zinc-800",
              "bg-white dark:bg-zinc-950",
              "touch-pan-y"
            )}
            style={{
              transform: `translate3d(${offsetX}px, 0, 0)`,
              transition: isDraggingRef.current ? "none" : "transform 180ms ease",
              willChange: "transform",
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchCancel}
            onClick={onClick}
          >
            <div className="flex justify-between w-full items-start gap-2">
              <span className="font-medium text-sm leading-tight text-foreground line-clamp-1">
                {notification.title}
              </span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 uppercase",
                  getPriorityBadgeClass(notification.priority)
                )}
              >
                {getPriorityLabel(notification.priority)}
              </span>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed w-full">
              {stripInternalRefs(notification.message)}
            </p>

            <div className="flex items-center justify-between w-full mt-1 pt-1 border-t border-zinc-50 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                {notification.category && (
                  <span className="uppercase tracking-wider font-semibold text-[9px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
                    {notification.category}
                  </span>
                )}
                {notification.functionalArea && (
                  <span className="text-[9px]">{notification.functionalArea}</span>
                )}
              </div>
              <span className="text-[10px] text-zinc-400 whitespace-nowrap ml-auto">
                {timeAgo(notification.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-zinc-400 hover:text-accent"
          aria-label="Notificaciones"
          onClick={() => {
            if (isSoundEnabled && !audioUnlocked) {
              void unlockAudio();
            }
          }}
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(94vw,420px)] sm:w-96 max-h-[500px] overflow-hidden flex flex-col"
      >
        <DropdownMenuLabel className="flex justify-between items-center px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Notificaciones</span>
            {count > 0 && (
              <span className="text-xs font-normal text-muted-foreground bg-zinc-100 px-2 py-0.5 rounded-full dark:bg-zinc-800">
                {count} nuevas
              </span>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-zinc-400 hover:text-accent"
            onClick={(e) => {
              e.preventDefault();
              toggleSound();
            }}
            title={isSoundEnabled ? "Silenciar notificaciones" : "Activar sonido"}
          >
            {isSoundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
        </DropdownMenuLabel>
        
        <div className="overflow-y-auto overflow-x-hidden flex-1 p-1">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Bell className="h-8 w-8 opacity-20" />
              <span>No tienes notificaciones nuevas</span>
            </div>
          ) : (
            notifications.map((notification) =>
              isCompact ? (
                <SwipeableNotificationItem key={notification.id} notification={notification} />
              ) : (
                <DropdownMenuItem
                  key={notification.id}
                  className="cursor-pointer flex flex-col items-start gap-2 p-3 border-b last:border-0 border-zinc-100 dark:border-zinc-800 focus:bg-zinc-50 dark:focus:bg-zinc-800 rounded-md my-1"
                  onSelect={() => handleNotificationClick(notification)}
                >
                  <div className="flex justify-between w-full items-start gap-2">
                    <span className="font-medium text-sm leading-tight text-foreground line-clamp-1">
                      {notification.title}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 uppercase",
                        getPriorityBadgeClass(notification.priority)
                      )}
                    >
                      {getPriorityLabel(notification.priority)}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed w-full">
                    {stripInternalRefs(notification.message)}
                  </p>

                  <div className="flex items-center justify-between w-full mt-1 pt-1 border-t border-zinc-50 dark:border-zinc-800">
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                      {notification.category && (
                        <span className="uppercase tracking-wider font-semibold text-[9px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
                          {notification.category}
                        </span>
                      )}
                      {notification.functionalArea && (
                        <span className="text-[9px]">{notification.functionalArea}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 whitespace-nowrap ml-auto">
                      {timeAgo(notification.createdAt)}
                    </span>
                  </div>
                </DropdownMenuItem>
              )
            )
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
