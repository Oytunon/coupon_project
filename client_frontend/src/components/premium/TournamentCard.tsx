import React from 'react';
import { Trophy, Calendar, Users, ArrowRight, Star } from 'lucide-react';
import { Button } from '../ui/button';
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
    onJoin,
    onDetails
}) => {
    const isActive = status === 'active';
    // Use VITE_API_URL or fall back to window.location.origin
    const baseUrl = (import.meta as any).env.VITE_API_URL || '';

    return (
        <Card className="group overflow-hidden bg-black/40 border-white/5 backdrop-blur-xl hover:border-amber-500/30 transition-all duration-300 flex flex-col h-full shadow-2xl relative">
            {/* Banner Image */}
            <div className="relative h-48 w-full overflow-hidden bg-black">
                {image_url ? (
                    <img
                        src={`${baseUrl}${image_url}`}
                        alt={name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-amber-950/20">
                        <Trophy className="h-16 w-16 text-amber-500/10" />
                    </div>
                )}

                {/* Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent" />

                <div className="absolute top-4 left-4">
                    <Badge className={`${isActive ? 'bg-emerald-500/90 text-white' : 'bg-neutral-800 text-muted-foreground'} backdrop-blur-md border-none font-bold px-3 py-1`}>
                        {isActive ? 'AKTİF' : status.toUpperCase()}
                    </Badge>
                </div>

                {isJoined && (
                    <div className="absolute top-4 right-4 bg-amber-500 text-black px-2 py-1 rounded text-[10px] font-black tracking-tighter shadow-lg flex items-center gap-1 animate-pulse">
                        <Star className="h-3 w-3 fill-current" /> KATILIYORSUN
                    </div>
                )}
            </div>

            {/* Content */}
            <CardContent className="p-6 flex-1 flex flex-col relative">
                <div className="mb-4">
                    <h3 className="text-xl font-black text-white group-hover:text-amber-500 transition-colors line-clamp-1 mb-2 tracking-tight">
                        {name}
                    </h3>
                    <p className="text-sm text-neutral-400 line-clamp-2 leading-relaxed">
                        {description || "Bu kampanya için detaylı açıklama bulunmuyor."}
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6 mt-auto">
                    <div className="space-y-1">
                        <span className="text-[10px] text-neutral-500 uppercase font-black tracking-widest">Katılımcı</span>
                        <div className="flex items-center gap-2 text-white font-bold">
                            <Users className="h-4 w-4 text-amber-500" />
                            {participantCount}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] text-neutral-500 uppercase font-black tracking-widest">Başlangıç</span>
                        <div className="flex items-center gap-2 text-white font-medium text-xs">
                            <Calendar className="h-4 w-4 text-amber-500" />
                            {new Date(startDate).toLocaleDateString("tr-TR")}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <Button
                        onClick={() => onDetails?.(id)}
                        variant="outline"
                        className="flex-1 bg-white/5 border-white/10 hover:bg-white/10 hover:text-white text-neutral-300 font-bold"
                    >
                        Detaylar
                    </Button>
                    {!isJoined && isActive && (
                        <Button
                            onClick={() => onJoin?.(id)}
                            className="px-8 bg-amber-500 hover:bg-amber-600 text-black font-black transition-all hover:scale-105"
                        >
                            KATIL <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
