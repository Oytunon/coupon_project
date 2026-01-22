import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface Coupon {
    bet_id: string;
    created_at: string;
    points: number;
    state: string;
    is_processed: boolean;
    matches: any[];
    raw_bet_data?: any;
}

interface CouponListProps {
    coupons: Coupon[];
}

export function CouponList({ coupons }: CouponListProps) {

    const getBadgeVariant = (state: string) => {
        switch (state.toLowerCase()) {
            case 'won': return 'default'; // Greenish usually
            case 'lost': return 'destructive';
            case 'open': return 'secondary';
            default: return 'outline';
        }
    };

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Kupon ID</TableHead>
                        <TableHead>Tarih</TableHead>
                        <TableHead>Durum</TableHead>
                        <TableHead className="text-right">Puan</TableHead>
                        <TableHead>Detaylar</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {coupons.map((coupon) => (
                        <TableRow key={coupon.bet_id}>
                            <TableCell className="font-medium">{coupon.bet_id}</TableCell>
                            <TableCell>
                                {format(new Date(coupon.created_at), "d MMMM yyyy HH:mm", { locale: tr })}
                            </TableCell>
                            <TableCell>
                                <Badge variant={getBadgeVariant(coupon.state)}>
                                    {coupon.state.toUpperCase()}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold">
                                {coupon.points?.toFixed(2)}
                            </TableCell>
                            <TableCell>
                                {coupon.raw_bet_data ? (
                                    <div className="text-xs text-muted-foreground max-w-[200px] truncate">
                                        {/* Fallback to showing some raw data info if parsed matches are missing */}
                                        Bahis Tipi: {coupon.raw_bet_data.Type === 1 ? "Tekli" : "Kombine"}
                                    </div>
                                ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                    {coupons.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                                Henüz kupon bulunmuyor.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
