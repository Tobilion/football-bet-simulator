import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Heart, Share2, Award, ShieldAlert, Sparkles, Send, CheckCircle2, RefreshCw } from "lucide-react";
import { Fixture, Team, MatchEvent } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface SocialFeedProps {
  fixtures: Fixture[];
  teams: Team[];
  roundLabel: string;
}

interface Post {
  id: string;
  authorName: string;
  authorHandle: string;
  avatarSeed: string;
  teamId?: string; // Supporter of
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  shares: number;
  isLikedByUser?: boolean;
  isVerified?: boolean;
  isTipster?: boolean;
}

export const SocialFeed: React.FC<SocialFeedProps> = ({ fixtures, teams, roundLabel }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [userPostText, setUserPostText] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("🦊");
  const postsEndRef = useRef<HTMLDivElement>(null);

  const getTeamName = (id: string) => {
    const t = teams.find((team) => team.id === id);
    return t ? t.name : "";
  };

  const getTeamShort = (id: string) => {
    const t = teams.find((team) => team.id === id);
    return t ? t.shortName : "";
  };

  // Base background posts for flavor
  const staticFlavorPosts: Post[] = [
    {
      id: "flavor-1",
      authorName: "CU Bet Advisor",
      authorHandle: "CUBetAdvisor",
      avatarSeed: "📈",
      content: `🔥 VALUE BET ALERT: Standard payout stats show Home teams are dominating under this tournament seeder. Double chance draw/away odds are currently inflated! Get on it before matches start.`,
      timestamp: "5m ago",
      likes: 42,
      comments: 11,
      shares: 3,
      isVerified: true,
      isTipster: true,
    },
    {
      id: "flavor-2",
      authorName: "Transfer Gossip Central",
      authorHandle: "TransferTalk",
      avatarSeed: "⚽",
      content: `🚨 EXCLUSIVE: Word on the street is that several elite European scouts are in the VIP boxes watching the matches this round. Major transfers on the horizon!`,
      timestamp: "12m ago",
      likes: 85,
      comments: 24,
      shares: 19,
      isVerified: true,
    },
    {
      id: "flavor-3",
      authorName: "Toby Thorne",
      authorHandle: "Toby_Fan99",
      avatarSeed: "🦁",
      content: `Can't believe the current standings! Betting simulator is looking clean today. Need a few multipliers to land so I can unlock that custom Yacht in the VIP luxury catalog. 🛥️`,
      timestamp: "20m ago",
      likes: 19,
      comments: 4,
      shares: 0,
    },
    {
      id: "flavor-4",
      authorName: "Coach Marcus",
      authorHandle: "MarcusManager",
      avatarSeed: "🎓",
      content: `Tactical rundown: Squad fitness and formation strategy are crucial. Roster form rates have shifted. Check the Team Rosters panel before you commit high stakes. Over/Under goals look promising.`,
      timestamp: "32m ago",
      likes: 112,
      comments: 19,
      shares: 8,
      isVerified: true,
    },
  ];

  // Initialize posts or reload
  useEffect(() => {
    const cached = localStorage.getItem("fs_social_posts");
    if (cached) {
      setPosts(JSON.parse(cached));
    } else {
      setPosts(staticFlavorPosts);
    }
  }, []);

  // Sync posts to localStorage
  const savePosts = (updatedList: Post[]) => {
    setPosts(updatedList);
    localStorage.setItem("fs_social_posts", JSON.stringify(updatedList));
  };

  // Turn a single match event into a fan-zone post. Covers the full range of
  // in-play moments (goals, cards, saves, near-misses, hard fouls, half/full
  // time) so the feed reacts frequently and contextually to what's happening.
  const buildPostForEvent = (f: Fixture, ev: MatchEvent): Post | null => {
    const homeName = getTeamShort(f.homeTeamId);
    const awayName = getTeamShort(f.awayTeamId);
    const isHome = ev.teamId === f.homeTeamId;
    const score = `${homeName} ${Math.floor(f.homeScore)} - ${Math.floor(f.awayScore)} ${awayName}`;
    const base = { id: `live-event-${f.id}-${ev.minute}-${ev.type}-${ev.playerName ?? ""}`, teamId: ev.teamId };

    let authorName = "SuperFan", authorHandle = "superfan", avatarSeed = "⚽", content = "";
    switch (ev.type) {
      case "GOAL":
        authorName = isHome ? `${homeName} Ultra` : `${awayName} Faithful`;
        authorHandle = isHome ? `${homeName}_Army` : `${awayName}HQ`;
        avatarSeed = isHome ? "⚡" : "🔥";
        content = `🚨 GOOOOAAAL!!! ${ev.playerName} finds the net in the ${ev.minute}'! ${score}. Live odds are swinging! 📈`;
        break;
      case "RED_CARD":
        authorName = "Ref Analyst"; authorHandle = "RefRundown"; avatarSeed = "🟥";
        content = `⚠️ RED CARD! ${ev.playerName} (${getTeamName(ev.teamId ?? "")}) walks in the ${ev.minute}'. Down to 10 — markets repricing fast! 🍿`;
        break;
      case "YELLOW_CARD":
        authorName = "Card Watcher"; authorHandle = "BookingGossip"; avatarSeed = "🟨";
        content = `Booking! Yellow for ${ev.playerName} (${ev.minute}'). Cards line is heating up — check your Over/Under bookings! 🎴`;
        break;
      case "SAVE":
        authorName = "Goalie Union"; authorHandle = "SaveStats"; avatarSeed = "🧤";
        content = `WHAT A SAVE in the ${ev.minute}'! ${ev.playerName ?? "The keeper"} keeps it level. ${score} — saves line ticking up! 🙌`;
        break;
      case "MISS":
        authorName = "Chance Tracker"; authorHandle = "xGwatch"; avatarSeed = "😱";
        content = `SO CLOSE! ${ev.playerName ?? "A striker"} agonisingly misses in the ${ev.minute}'! Inches from changing the ${score} scoreline! 🎯`;
        break;
      case "FOUL":
        authorName = "Touchline Cam"; authorHandle = "PitchSide"; avatarSeed = "😤";
        content = `Crunching foul in the ${ev.minute}'! Tempers rising between ${homeName} and ${awayName}. 🔥`;
        break;
      case "HALF_TIME":
        authorName = "Match Desk"; authorHandle = "HTReport"; avatarSeed = "⏸️";
        content = `⏸️ HALF TIME: ${score}. Cash out or double down? Live prices are settling for the break.`;
        break;
      case "FULL_TIME":
        authorName = "Full Time Wire"; authorHandle = "FTsiren"; avatarSeed = "🏁";
        content = `🏁 FULL TIME: ${score}. All tickets on this one settle now — good luck! 🎟️`;
        break;
      default:
        return null; // ASSIST/KICKOFF/COMMENTARY skipped to reduce noise
    }
    return {
      ...base,
      authorName, authorHandle, avatarSeed, content,
      timestamp: "Just now",
      likes: Math.floor(Math.random() * 25) + 3,
      comments: Math.floor(Math.random() * 5) + 1,
      shares: Math.floor(Math.random() * 4),
    };
  };

  // Build live event posts dynamically — process EVERY new event across active
  // matches (not just the single latest) so the feed updates within seconds of
  // each goal, card, corner, near-miss or whistle.
  useEffect(() => {
    const activeFixtures = fixtures.filter((f) => f.status === "LIVE" || f.status === "FT");
    if (activeFixtures.length === 0) return;

    setPosts((current) => {
      const existingIds = new Set(current.map((p) => p.id));
      const fresh: Post[] = [];
      activeFixtures.forEach((f) => {
        // Look at the most recent handful of events per fixture for reactions.
        (f.events ?? []).slice(-5).forEach((ev) => {
          const post = buildPostForEvent(f, ev);
          if (post && !existingIds.has(post.id) && !fresh.some((p) => p.id === post.id)) {
            fresh.push(post);
          }
        });
      });
      if (fresh.length === 0) return current;
      const updated = [...fresh, ...current].slice(0, 40);
      localStorage.setItem("fs_social_posts", JSON.stringify(updated));
      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtures]);

  // Fully clear the feed when the match/round changes (new game session) so
  // stale banter from a previous match never lingers.
  const prevRoundRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevRoundRef.current !== null && prevRoundRef.current !== roundLabel) {
      localStorage.removeItem("fs_social_posts");
      setPosts(staticFlavorPosts);
    }
    prevRoundRef.current = roundLabel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundLabel]);

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPostText.trim()) return;

    const newUserPost: Post = {
      id: `user-post-${Date.now()}`,
      authorName: "You (CU Bet VIP)",
      authorHandle: "MyBetsMaster",
      avatarSeed: selectedAvatar,
      content: userPostText,
      timestamp: "Just now",
      likes: 0,
      comments: 0,
      shares: 0,
    };

    const updated = [newUserPost, ...posts];
    savePosts(updated);
    setUserPostText("");

    // Simulate occasional immediate comment/likes response to user posts for high engagement feeling!
    setTimeout(() => {
      setPosts((currentPosts) => {
        return currentPosts.map((p) => {
          if (p.id === newUserPost.id) {
            return {
              ...p,
              likes: Math.floor(Math.random() * 4) + 2,
              comments: 1,
            };
          }
          return p;
        });
      });
    }, 4000);
  };

  const handleLike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = posts.map((p) => {
      if (p.id === id) {
        const isCurrentlyLiked = p.isLikedByUser;
        return {
          ...p,
          likes: isCurrentlyLiked ? p.likes - 1 : p.likes + 1,
          isLikedByUser: !isCurrentlyLiked,
        };
      }
      return p;
    });
    savePosts(updated);
  };

  const handleResetFeed = () => {
    localStorage.removeItem("fs_social_posts");
    setPosts(staticFlavorPosts);
  };

  const avatarsList = ["🦊", "🦁", "🦈", "🦅", "🦍", "🐉", "🤖", "🔥", "⚽", "🏆", "🌟"];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 max-w-4xl mx-auto animate-fade-in">
      {/* Intro Bannner */}
      <div className="glass-panel rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 border-emerald-500/10">
        <div className="space-y-1">
          <span className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase font-black">
            🔴 Live Fan Zone & community Timeline
          </span>
          <h2 className="text-sm font-bold text-slate-100 font-sans tracking-tight">
            CU Bet Supporter Hub — Live Reactions
          </h2>
          <p className="text-xs text-slate-400">
            Read current tournament banter, transfer gossip, and expert betting advice. Posts react to match goal tickers in real-time!
          </p>
        </div>
        <button
          onClick={handleResetFeed}
          className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-350 hover:text-emerald-400 px-3 py-1.5 rounded-xl text-xs transition-all border border-white/5 cursor-pointer"
        >
          <RefreshCw size={12} />
          Reset Banter
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Post Creator */}
        <div className="md:col-span-1 glass-panel rounded-2xl p-4 h-fit border-white/5 space-y-4">
          <div className="border-b border-white/5 pb-2">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block font-bold">
              Post Your Prediction
            </span>
          </div>

          <form onSubmit={handleCreatePost} className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-400 font-mono block mb-1">Pick Supporter Badge</label>
              <div className="flex flex-wrap gap-1.5">
                {avatarsList.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setSelectedAvatar(av)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all border cursor-pointer select-none ${
                      selectedAvatar === av
                        ? "bg-emerald-500/15 border-emerald-500 text-white shadow-sm"
                        : "bg-black/20 border-white/5 text-slate-400 hover:border-white/10"
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="userPostText" className="text-[10px] text-slate-400 font-mono block mb-1">Slander or Cheer</label>
              <textarea
                id="userPostText"
                value={userPostText}
                onChange={(e) => setUserPostText(e.target.value)}
                placeholder="Write a hot take... e.g., HOME TEAM DRAW SLAYED! Elite Casino bets hit!"
                maxLength={250}
                className="w-full text-xs p-3 rounded-xl bg-black/30 border border-white/5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none h-24"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={!userPostText.trim()}
              className="w-full py-2 bg-emerald-500 hover:bg-emerald-555 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer"
            >
              <Send size={12} strokeWidth={2.5} />
              Publish Status
            </button>
          </form>
        </div>

        {/* Right Side: Timeline Stream */}
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-mono text-slate-400 font-bold uppercase select-none">
              Timeline Gossip ({posts.length} Posts)
            </span>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-450 animate-pulse">
              <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full"></span>
              Live Feed Connected
            </div>
          </div>

          <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1 select-none custom-scrollbar pb-12">
            <AnimatePresence initial={false}>
              {posts.map((post) => {
                const team = post.teamId ? teams.find((t) => t.id === post.teamId) : null;
                return (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="glass-card rounded-xl p-4 border border-white/5 space-y-2.5 hover:border-white/10 transition-all bg-[#0a111a]/80"
                  >
                    {/* Post Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-lg select-none">
                          {post.avatarSeed}
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-slate-200 leading-none">
                              {post.authorName}
                            </span>
                            {post.isVerified && (
                              <CheckCircle2 size={11} className="text-sky-400 fill-sky-400/10 shrink-0" />
                            )}
                            {post.isTipster && (
                              <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1 py-0.2 rounded font-mono uppercase font-extrabold select-none shrink-0">
                                PRO TIPSTER
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                            @{post.authorHandle}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {team && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold text-emerald-350 border border-emerald-500/10"
                            style={{ backgroundColor: `${team.primaryColor}15`, color: team.primaryColor }}
                          >
                            {team.shortName} supporter
                          </span>
                        )}
                        <span className="text-[9px] font-mono text-slate-500">
                          {post.timestamp}
                        </span>
                      </div>
                    </div>

                    {/* Post Content */}
                    <p className="text-xs text-slate-350 leading-relaxed break-words whitespace-pre-wrap pl-11">
                      {post.content}
                    </p>

                    {/* Action Stats buttons */}
                    <div className="flex items-center gap-6 text-[10px] font-mono text-slate-500 pl-11 pt-1 border-t border-white/5 select-none">
                      <button
                        onClick={(e) => handleLike(post.id, e)}
                        className={`flex items-center gap-1 px-1 py-0.5 rounded hover:text-red-400 transition-all cursor-pointer ${
                          post.isLikedByUser ? "text-red-400" : ""
                        }`}
                      >
                        <Heart size={12} className={post.isLikedByUser ? "fill-red-400/20" : ""} />
                        <span>{post.likes}</span>
                      </button>
                      <div className="flex items-center gap-1">
                        <MessageSquare size={12} />
                        <span>{post.comments}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Share2 size={12} />
                        <span>{post.shares}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
