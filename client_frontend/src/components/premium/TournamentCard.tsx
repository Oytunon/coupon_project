import React from 'react';
import { Trophy, Calendar, Users, ArrowRight, Star, Clock, Coins, User, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

interface TournamentCardProps {
    id: number;
    name: string;
    description: string;
    image_url?: string;
    status: string;
    startDate: string;
    endDate: string;
    participantCount?: number;
    isJoined?: boolean;
    userPoints?: number;
    userRank?: number;
    rewardAmount?: string;
    onJoin?: (id: number) => void;
    onDetails?: (id: number) => void;
}

export const TournamentCard: React.FC<TournamentCardProps> = ({
    id,
    name,
    description,
    image_url,
    status,
    startDate,
    participantCount = 0,
    isJoined = false,
    userPoints = 0,
    userRank = 0,
    rewardAmount = "10.000.000₺",
    onJoin,
    onDetails
}) => {
    const isActive = status === 'active';
    const baseUrl = (import.meta as any).env.VITE_API_URL || '';

    return (
        <Card className="group overflow-hidden bg-black/60 border-primary/20 backdrop-blur-2xl hover:border-primary/50 transition-all duration-500 mb-6 border-2 relative">
            <div className="flex flex-col lg:flex-row h-full">
                {/* Left: Banner Image */}
                <div className="relative w-full lg:w-[320px] h-[240px] lg:h-auto overflow-hidden bg-black">
                    {image_url ? (
                        <img
                            src={`${baseUrl}${image_url}`}
                            alt={name}
                            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-black">
                            <Trophy className="h-20 w-20 text-primary/10" />
                        </div>
                    )}

                    {/* Badge Overlay */}
                    <div className="absolute top-4 left-4">
                        <Badge className={`${isActive ? 'bg-primary text-black' : 'bg-neutral-800 text-muted-foreground'} border-none font-black px-4 py-1.5 rounded-md italic text-[11px] shadow-lg`}>
                            {isActive ? 'AKTİF' : status.toUpperCase()}
                        </Badge>
                    </div>

                    {isJoined && (
                        <div className="absolute top-4 right-4 bg-primary text-black px-3 py-1.5 rounded-md text-[10px] font-black italic shadow-[0_0_15px_rgba(255,188,0,0.4)] flex items-center gap-1">
                            <Star className="h-3 w-3 fill-current" /> KATILIYORSUN
                        </div>
                    )}
                </div>

                {/* Right: Content Area */}
                <CardContent className="p-8 flex-1 flex flex-col lg:flex-row gap-8 items-center justify-between">
                    <div className="flex-1 space-y-8 w-full text-center lg:text-left">
                        {/* Title & Info Boxes Group */}
                        <div className="flex flex-col lg:flex-row items-center gap-12">
                            <div className="text-center lg:text-left">
                                <h3 className="text-4xl font-black text-white group-hover:text-primary transition-colors tracking-tighter uppercase mb-4 italic">
                                    {name}
                                </h3>

                                <div className="flex items-center justify-center lg:justify-start gap-4 h-24">
                                    <div className="bg-primary/5 border border-primary/20 rounded-2xl px-8 py-4 flex flex-col items-center justify-center min-w-[140px] shadow-inner relative overflow-hidden group/box">
                                        <div className="absolute inset-0 bg-primary/5 translate-y-full group-hover/box:translate-y-0 transition-transform duration-500"></div>
                                        <span className="text-[10px] text-primary font-black uppercase tracking-widest mb-1 relative z-10 flex items-center gap-1">
                                            <Users className="h-3 w-3" /> KATILIMCI
                                        </span>
                                        <span className="text-2xl font-black text-white relative z-10 tabular-nums">
                                            {participantCount.toLocaleString('tr-TR')}
                                        </span>
                                    </div>

                                    <div className="bg-primary/5 border border-primary/20 rounded-2xl px-8 py-4 flex flex-col items-center justify-center min-w-[140px] shadow-inner relative overflow-hidden group/box">
                                        <div className="absolute inset-0 bg-primary/5 translate-y-full group-hover/box:translate-y-0 transition-transform duration-500"></div>
                                        <span className="text-[10px] text-primary font-black uppercase tracking-widest mb-1 relative z-10 flex items-center gap-1">
                                            <Trophy className="h-3 w-3" /> ÖDÜL
                                        </span>
                                        <span className="text-2xl font-black text-primary relative z-10 shadow-primary/20 blur-[0.3px]">
                                            {rewardAmount}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Center: Countdown Timer */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="flex gap-2">
                                    <div className="flex flex-col items-center">
                                        <div className="w-14 h-14 bg-black border border-primary/30 rounded-lg flex items-center justify-center text-primary text-2xl font-black shadow-[0_0_10px_rgba(255,188,0,0.1)]">15</div>
                                        <span className="text-[9px] font-black text-primary/60 mt-1 uppercase">GÜN</span>
                                    </div>
                                    <div className="text-primary text-2xl font-black mt-3">:</div>
                                    <div className="flex flex-col items-center">
                                        <div className="w-14 h-14 bg-black border border-primary/30 rounded-lg flex items-center justify-center text-primary text-2xl font-black shadow-[0_0_10px_rgba(255,188,0,0.1)]">06</div>
                                        <span className="text-[9px] font-black text-primary/60 mt-1 uppercase">SAAT</span>
                                    </div>
                                    <div className="text-primary text-2xl font-black mt-3">:</div>
                                    <div className="flex flex-col items-center">
                                        <div className="w-14 h-14 bg-black border border-primary/30 rounded-lg flex items-center justify-center text-primary text-2xl font-black shadow-[0_0_10px_rgba(255,188,0,0.1)]">30</div>
                                        <span className="text-[9px] font-black text-primary/60 mt-1 uppercase">DAK</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Stats & Action */}
                    <div className="flex flex-col lg:items-end gap-6 w-full lg:w-auto">
                        <div className="flex items-center lg:items-end flex-row lg:flex-col lg:gap-2 justify-center gap-8">
                            <div className="text-center lg:text-right">
                                <div className="flex items-center gap-2 justify-center lg:justify-end text-[11px] text-white/50 font-black tracking-widest mb-1 uppercase">
                                    <BarChart3 className="h-3 w-3" /> PUANIM
                                </div>
                                <div className="text-4xl font-black text-white tabular-nums">
                                    {userPoints.toLocaleString('tr-TR')}
                                </div>
                            </div>
                            <div className="text-center lg:text-right">
                                <div className="flex items-center gap-2 justify-center lg:justify-end text-[11px] text-white/50 font-black tracking-widest mb-1 uppercase">
                                    <Trophy className="h-3 w-3" /> SIRALAMA
                                </div>
                                <div className="text-4xl font-black text-primary italic">
                                    #{userRank}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 w-full lg:w-auto mt-4">
                            <button
                                onClick={() => onDetails?.(id)}
                                className="flex-1 lg:flex-none px-12 py-3 bg-primary text-black font-black text-sm rounded-lg hover:scale-105 transition-all shadow-[0_0_25px_rgba(255,188,0,0.3)] uppercase italic"
                            >
                                DETAYLAR
                            </button>
                        </div>
                    </div>
                </CardContent>
            </div>
        </Card>
    );
};
