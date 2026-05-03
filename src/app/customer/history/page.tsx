import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Calendar, Star, Download, Filter } from 'lucide-react';

export default function HistoryPage() {
  const pastBookings = [
    {
      id: 1,
      spa: 'Ethereal Beauty Lounge',
      service: 'Signature Facial',
      date: '2026-03-15',
      time: '10:00 AM',
      duration: '60 min',
      status: 'completed',
      price: '$85',
      rating: 5,
    },
    {
      id: 2,
      spa: 'Serenity Spa & Salon',
      service: 'Deep Tissue Massage',
      date: '2026-03-08',
      time: '2:00 PM',
      duration: '90 min',
      status: 'completed',
      price: '$120',
      rating: 4,
    },
    {
      id: 3,
      spa: 'The Glamour Studio',
      service: 'Hair Coloring',
      date: '2026-02-28',
      time: '11:30 AM',
      duration: '120 min',
      status: 'completed',
      price: '$150',
      rating: 5,
    },
  ];

  const cancelledBookings = [
    {
      id: 4,
      spa: 'Radiant Glow Wellness',
      service: 'Hot Stone Treatment',
      date: '2026-02-20',
      time: '3:00 PM',
      duration: '90 min',
      status: 'cancelled',
      price: '$110',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/30 to-white">
      <header className="border-b border-rose-100/50 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-600" />
            <span className="text-xl font-serif font-semibold bg-gradient-to-r from-amber-700 to-rose-600 bg-clip-text text-transparent">
              Glamornate
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/customer/dashboard" className="text-rose-800/70 hover:text-amber-600">Dashboard</Link>
            <Link href="/customer/bookings" className="text-rose-800/70 hover:text-amber-600">Bookings</Link>
            <Link href="/customer/history" className="text-amber-600 font-medium">History</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/customer/profile" className="text-rose-700 hover:text-amber-600">Profile</Link>
            <Button variant="outline" className="border-rose-200">Sign Out</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-serif font-semibold text-rose-800 mb-2">Booking History</h1>
              <p className="text-rose-700/60">View your past appointments</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="border-rose-200">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline" className="border-amber-200">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Completed Bookings */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-rose-800 mb-4">Completed</h2>
            <div className="space-y-4">
              {pastBookings.map((booking) => (
                <Card key={booking.id} className="border-rose-100 hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-amber-100 to-rose-100 rounded-xl flex items-center justify-center">
                          <Calendar className="w-7 h-7 text-amber-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-rose-800 mb-1">{booking.service}</h3>
                          <p className="text-sm text-rose-700/60 mb-2">{booking.spa}</p>
                          <div className="flex items-center gap-4 text-sm text-rose-700/60">
                            <span>{booking.date}</span>
                            <span>•</span>
                            <span>{booking.time}</span>
                            <span>•</span>
                            <span>{booking.duration}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-amber-600 mb-2">{booking.price}</p>
                        <div className="flex items-center gap-1 text-amber-500">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`w-4 h-4 ${i < booking.rating ? 'fill-amber-500 text-amber-500' : 'text-rose-200'}`} />
                          ))}
                        </div>
                        {booking.rating < 5 && (
                          <Button size="sm" variant="link" className="text-amber-600 h-auto p-0 mt-2">
                            Leave Review
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Cancelled Bookings */}
          {cancelledBookings.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-rose-800 mb-4">Cancelled</h2>
              <div className="space-y-4">
                {cancelledBookings.map((booking) => (
                  <Card key={booking.id} className="border-rose-100 border-dashed bg-rose-50/30">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex gap-4">
                          <div className="w-14 h-14 bg-rose-100 rounded-xl flex items-center justify-center">
                            <Calendar className="w-7 h-7 text-rose-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-rose-800/60 mb-1">{booking.service}</h3>
                            <p className="text-sm text-rose-700/40 mb-2">{booking.spa}</p>
                            <div className="flex items-center gap-4 text-sm text-rose-700/40">
                              <span>{booking.date}</span>
                              <span>•</span>
                              <span>{booking.time}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="px-3 py-1 bg-rose-100 text-rose-600 rounded-full text-sm">Cancelled</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Stats */}
          <Card className="mt-8 border-amber-200 bg-gradient-to-br from-amber-50 to-rose-50">
            <CardContent className="p-6">
              <h3 className="font-semibold text-rose-800 mb-4">Your Wellness Journey</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-rose-600 bg-clip-text text-transparent">12</div>
                  <div className="text-sm text-rose-700/60">Total Visits</div>
                </div>
                <div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-rose-600 bg-clip-text text-transparent">$945</div>
                  <div className="text-sm text-rose-700/60">Total Spent</div>
                </div>
                <div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-rose-600 bg-clip-text text-transparent">4.8</div>
                  <div className="text-sm text-rose-700/60">Average Rating</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t border-rose-100 bg-rose-50/30 py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-rose-700/60">
          <p>© 2026 Glamornate. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
