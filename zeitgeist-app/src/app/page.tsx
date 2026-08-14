import { ShootingStarsAndStarsBackgroundDemo } from "@/components/shooting-stars-background-demo";
import { Carousel, Card } from "@/components/ui/apple-cards-carousel";
import Link from "next/link";
import {
  TrendingUp,
  BarChart3,
  Brain,
  Target,
  Shield,
  Zap,
  Activity,
  CandlestickChart,
  Clock,
  Landmark,
  MessageSquare,
  Scale,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export default function Home() {
  const cards = data.map((card, index) => (
    <Card key={card.src} card={card} index={index} />
  ));

  return (
    <div className="bg-black">
      <ShootingStarsAndStarsBackgroundDemo />

      {/* Apple Carousel Section */}
      <div className="w-full h-full py-20 px-8 md:px-16">
        <h2 className="text-xl md:text-5xl font-bold text-neutral-200 dark:text-neutral-200 font-sans">
          Discover the power of Zeitgeist.
        </h2>
        <Carousel items={cards} />
      </div>

      {/* Featured Stock Analysis Section */}
      <section className="w-full bg-black px-6 py-28 md:py-36">
        <div className="mx-auto max-w-5xl text-center">
          <p className="mb-4 text-base font-medium text-[#2997ff] md:text-lg">
            Featured Tool
          </p>
          <h2 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Smart Stock Analysis
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-xl font-normal text-neutral-400 md:text-2xl">
            Real-time data. Intelligent insights. Every decision, informed.
          </p>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/stock-analysis"
              className="rounded-full bg-[#0071e3] px-6 py-3 text-[17px] text-white transition-colors hover:bg-[#0077ed]"
            >
              Start analyzing
            </Link>
            <Link
              href="/stock-analysis"
              className="rounded-full border border-[#0071e3] px-6 py-3 text-[17px] text-[#2997ff] transition-colors hover:bg-[#0071e3]/10"
            >
              Learn more
            </Link>
          </div>

          {/* Feature tiles */}
          <div className="mt-24 grid gap-5 text-left md:grid-cols-3">
            <div className="rounded-3xl bg-[#1d1d1f] p-8 transition-colors duration-300 hover:bg-[#232326]">
              <TrendingUp className="h-8 w-8 text-[#2997ff]" strokeWidth={1.5} />
              <h3 className="mt-6 text-xl font-semibold text-white">
                Real-Time Analysis
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-neutral-400">
                Live market data with instant AI analysis of price movements,
                trends, and patterns.
              </p>
            </div>

            <div className="rounded-3xl bg-[#1d1d1f] p-8 transition-colors duration-300 hover:bg-[#232326]">
              <Brain className="h-8 w-8 text-[#2997ff]" strokeWidth={1.5} />
              <h3 className="mt-6 text-xl font-semibold text-white">
                AI-Powered Insights
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-neutral-400">
                Advanced models deliver comprehensive fundamental and technical
                analysis in seconds.
              </p>
            </div>

            <div className="rounded-3xl bg-[#1d1d1f] p-8 transition-colors duration-300 hover:bg-[#232326]">
              <Target className="h-8 w-8 text-[#2997ff]" strokeWidth={1.5} />
              <h3 className="mt-6 text-xl font-semibold text-white">
                Smart Recommendations
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-neutral-400">
                Actionable recommendations with risk assessment and clear price
                targets.
              </p>
            </div>
          </div>

          <p className="mt-16 text-sm text-neutral-500">
            Try popular stocks:{" "}
            {["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"].map((ticker, index) => (
              <Link
                key={ticker}
                href="/stock-analysis"
                className="text-[#2997ff] transition-colors hover:text-white"
              >
                {ticker}
                {index < 4 ? ", " : ""}
              </Link>
            ))}
          </p>
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                        Shared card content building blocks                  */
/* -------------------------------------------------------------------------- */

const CardShell = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[#F5F5F7] dark:bg-neutral-800 p-8 md:p-14 rounded-3xl mb-4">
    {children}
  </div>
);

const Lead = ({
  headline,
  children,
}: {
  headline: string;
  children: React.ReactNode;
}) => (
  <p className="text-neutral-600 dark:text-neutral-400 text-base md:text-2xl font-sans max-w-3xl mx-auto">
    <span className="font-bold text-neutral-700 dark:text-neutral-200">
      {headline}
    </span>{" "}
    {children}
  </p>
);

const FeatureTile = ({
  icon: Icon,
  gradient,
  title,
  children,
}: {
  icon: LucideIcon;
  gradient: string;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="text-center bg-neutral-200 dark:bg-neutral-700 p-6 rounded-2xl">
    <div className="flex justify-center mb-4">
      <div className={`p-3 rounded-full bg-gradient-to-br ${gradient}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
    <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-200 mb-2">
      {title}
    </h3>
    <p className="text-sm text-neutral-600 dark:text-neutral-400">{children}</p>
  </div>
);

const DetailRow = ({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-start gap-4">
    <div className={`flex-shrink-0 p-2 rounded-lg ${tone}`}>
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <h4 className="font-semibold text-neutral-700 dark:text-neutral-200 mb-1">
        {title}
      </h4>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {children}
      </p>
    </div>
  </div>
);

const CardCta = ({
  href,
  gradient,
  heading,
  blurb,
  label,
  icon: Icon,
}: {
  href: string;
  gradient: string;
  heading: string;
  blurb: string;
  label: string;
  icon: LucideIcon;
}) => (
  <div className={`text-center bg-gradient-to-br ${gradient} p-8 rounded-2xl`}>
    <h3 className="text-2xl font-bold text-white mb-4">{heading}</h3>
    <p className="text-white/80 mb-6 max-w-2xl mx-auto">{blurb}</p>
    <Link
      href={href}
      className="inline-flex items-center gap-2 bg-white text-neutral-900 font-semibold px-8 py-3 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  </div>
);

const Disclaimer = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-6 text-center">
    <p className="text-xs text-neutral-500 dark:text-neutral-400">{children}</p>
  </div>
);

/* -------------------------------------------------------------------------- */
/*                              Carousel card content                          */
/* -------------------------------------------------------------------------- */

const StockAnalysisContent = () => {
  return (
    <div className="bg-[#F5F5F7] dark:bg-neutral-800 p-8 md:p-14 rounded-3xl mb-4">
      <p className="text-neutral-600 dark:text-neutral-400 text-base md:text-2xl font-sans max-w-3xl mx-auto mb-8">
        <span className="font-bold text-neutral-700 dark:text-neutral-200">
          AI-powered investment insights at your fingertips.
        </span>{" "}
        Get comprehensive stock analysis with real-time market data, technical indicators,
        fundamental analysis, and intelligent investment recommendations. Make informed
        decisions with advanced AI that processes market patterns and financial data instantly.
      </p>

      {/* Feature Grid */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <div className="text-center bg-neutral-200 dark:bg-neutral-700 p-6 rounded-2xl">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-200 mb-2">
            Real-Time Data
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Live market prices, volume, and trading data from reliable sources
          </p>
        </div>

        <div className="text-center bg-neutral-200 dark:bg-neutral-700 p-6 rounded-2xl">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full">
              <Brain className="h-6 w-6 text-white" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-200 mb-2">
            AI Analysis
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Advanced machine learning models analyze patterns and market sentiment
          </p>
        </div>

        <div className="text-center bg-neutral-200 dark:bg-neutral-700 p-6 rounded-2xl">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full">
              <Target className="h-6 w-6 text-white" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-200 mb-2">
            Smart Insights
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Actionable recommendations with confidence scores and risk assessment
          </p>
        </div>
      </div>

      {/* Key Benefits */}
      <div className="space-y-6 mb-12">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
            <BarChart3 className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h4 className="font-semibold text-neutral-700 dark:text-neutral-200 mb-1">
              Technical Analysis
            </h4>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Interactive charts with support/resistance levels, trend analysis, and key technical indicators
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h4 className="font-semibold text-neutral-700 dark:text-neutral-200 mb-1">
              Risk Assessment
            </h4>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Comprehensive risk analysis with detailed factor breakdowns and volatility metrics
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
            <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h4 className="font-semibold text-neutral-700 dark:text-neutral-200 mb-1">
              Price Targets
            </h4>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Short, medium, and long-term price projections based on comprehensive analysis
            </p>
          </div>
        </div>
      </div>

      {/* Call-to-Action */}
      <div className="text-center bg-gradient-to-br from-indigo-500 to-purple-600 p-8 rounded-2xl">
        <h3 className="text-2xl font-bold text-white mb-4">
          Start Analyzing Stocks Today
        </h3>
        <p className="text-indigo-100 mb-6 max-w-2xl mx-auto">
          Enter any stock ticker to get instant AI-powered analysis with real-time data,
          charts, and investment insights. Completely free to use.
        </p>
        <Link
          href="/stock-analysis"
          className="inline-flex items-center gap-2 bg-white text-indigo-600 font-semibold px-8 py-3 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <TrendingUp className="h-5 w-5" />
          Try Stock Analysis
        </Link>
      </div>

      {/* Disclaimer */}
      <div className="mt-6 text-center">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          * Not financial advice. Data provided by Polygon.io. Analysis powered by Claude.
        </p>
      </div>
    </div>
  );
};

const CfoContent = () => {
  return (
    <CardShell>
      <Lead headline="Ask anything about money.">
        The Zeitgeist AI CFO answers financial questions in plain English — from
        runway and gross margin to paying down a credit card. Reach it from the
        chat bubble on any page, or open the full workspace for longer
        conversations.
      </Lead>

      <div className="grid md:grid-cols-3 gap-6 mt-12">
        <FeatureTile
          icon={MessageSquare}
          gradient="from-blue-500 to-cyan-600"
          title="Plain English"
        >
          Concepts explained before the jargon, with small worked examples
          instead of walls of text
        </FeatureTile>
        <FeatureTile
          icon={Landmark}
          gradient="from-emerald-500 to-teal-600"
          title="Business & Personal"
        >
          Unit economics, burn rate, and fundraising — or budgeting, debt payoff,
          and retirement accounts
        </FeatureTile>
        <FeatureTile
          icon={Clock}
          gradient="from-purple-500 to-indigo-600"
          title="Picks Up Where You Left Off"
        >
          Sign in and every conversation is saved, searchable, and ready to
          continue later
        </FeatureTile>
      </div>

      <div className="mt-12 bg-neutral-200 dark:bg-neutral-700 p-6 rounded-2xl">
        <h3 className="text-xl font-semibold text-neutral-700 dark:text-neutral-200 mb-4">
          Try asking
        </h3>
        <ul className="space-y-2 text-neutral-600 dark:text-neutral-400">
          <li>• &ldquo;How many months of runway do I have left?&rdquo;</li>
          <li>• &ldquo;What actually is a P/E ratio, and when does it matter?&rdquo;</li>
          <li>• &ldquo;Should I pay off my loan or invest the extra $500?&rdquo;</li>
          <li>• &ldquo;Walk me through my gross margin with real numbers.&rdquo;</li>
        </ul>
      </div>

      <div className="mt-12">
        <CardCta
          href="/cfo"
          gradient="from-blue-600 to-indigo-700"
          heading="Talk to the AI CFO"
          blurb="Open a conversation and ask anything about money. It asks for the numbers it needs instead of guessing."
          label="Start a conversation"
          icon={MessageSquare}
        />
      </div>

      <Disclaimer>
        * Financial education, not licensed financial, tax, or legal advice.
      </Disclaimer>
    </CardShell>
  );
};

const MarketDataContent = () => {
  return (
    <CardShell>
      <Lead headline="Live market data, straight from the tape.">
        Every analysis starts with real quotes pulled from Polygon.io — not
        stale numbers cached from last week. Price, volume, the full trading
        session, and 30 days of history land before the AI says a word.
      </Lead>

      <div className="grid md:grid-cols-3 gap-8 mt-12">
        <div className="text-center">
          <div className="text-4xl font-bold text-neutral-700 dark:text-neutral-200 mb-2">
            30d
          </div>
          <p className="text-neutral-600 dark:text-neutral-400">
            Of daily price history behind every chart
          </p>
        </div>
        <div className="text-center">
          <div className="text-4xl font-bold text-neutral-700 dark:text-neutral-200 mb-2">
            OHLC
          </div>
          <p className="text-neutral-600 dark:text-neutral-400">
            Open, high, low, and close for the current session
          </p>
        </div>
        <div className="text-center">
          <div className="text-4xl font-bold text-neutral-700 dark:text-neutral-200 mb-2">
            &lt;3s
          </div>
          <p className="text-neutral-600 dark:text-neutral-400">
            From ticker to data on screen
          </p>
        </div>
      </div>

      <div className="space-y-6 mt-12">
        <DetailRow
          icon={Activity}
          tone="bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400"
          title="Price and Movement"
        >
          Current price against previous close, with the change and percentage
          color-coded green or red at a glance
        </DetailRow>
        <DetailRow
          icon={BarChart3}
          tone="bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
          title="Volume and VWAP"
        >
          Session volume and volume-weighted average price, so you can tell a
          real move from a quiet drift
        </DetailRow>
        <DetailRow
          icon={Clock}
          tone="bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
          title="Market Status"
        >
          Open, closed, or extended-hours — always labeled with the timestamp of
          the last update
        </DetailRow>
      </div>

      <div className="mt-12">
        <CardCta
          href="/stock-analysis"
          gradient="from-emerald-600 to-teal-700"
          heading="Look up any ticker"
          blurb="Type a symbol and watch live pricing, the 30-day chart, and the AI read arrive together."
          label="Check a stock"
          icon={Activity}
        />
      </div>

      <Disclaimer>* Market data provided by Polygon.io.</Disclaimer>
    </CardShell>
  );
};

const TechnicalContent = () => {
  return (
    <CardShell>
      <Lead headline="Read the chart, not the noise.">
        Zeitgeist marks up the price history the way a technical analyst would:
        the trend, the levels that keep holding, and the indicators actually
        worth watching on this particular name.
      </Lead>

      <div className="grid md:grid-cols-3 gap-6 mt-12">
        <FeatureTile
          icon={TrendingUp}
          gradient="from-green-500 to-emerald-600"
          title="Trend Direction"
        >
          Every read is called bullish, bearish, or neutral — with the reasoning
          spelled out
        </FeatureTile>
        <FeatureTile
          icon={CandlestickChart}
          gradient="from-blue-500 to-cyan-600"
          title="Support & Resistance"
        >
          Concrete price levels where buyers have stepped in and sellers have
          taken over
        </FeatureTile>
        <FeatureTile
          icon={Zap}
          gradient="from-purple-500 to-indigo-600"
          title="Short-Term Outlook"
        >
          What the setup implies over the next few weeks, stated plainly
        </FeatureTile>
      </div>

      <div className="mt-12 bg-neutral-200 dark:bg-neutral-700 p-6 rounded-2xl">
        <h3 className="text-xl font-semibold text-neutral-700 dark:text-neutral-200 mb-4">
          On the chart
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-neutral-600 dark:text-neutral-400">
          <div>• 30-day interactive price history</div>
          <div>• Hover tooltips with exact daily prices</div>
          <div>• Support and resistance overlays</div>
          <div>• Responsive on phone, tablet, and desktop</div>
        </div>
      </div>

      <div className="mt-12">
        <CardCta
          href="/stock-analysis"
          gradient="from-sky-600 to-blue-700"
          heading="See the levels for yourself"
          blurb="Pull up any ticker and get the annotated chart alongside a written technical read."
          label="Open the chart"
          icon={CandlestickChart}
        />
      </div>

      <Disclaimer>
        * Technical analysis describes past price behavior. It does not
        guarantee future movement.
      </Disclaimer>
    </CardShell>
  );
};

const FundamentalsContent = () => {
  return (
    <CardShell>
      <Lead headline="What the business is actually worth.">
        Price is only half the story. Zeitgeist reads the company behind the
        ticker — how healthy the finances are, where growth is coming from, and
        whether today&apos;s price is a bargain or a stretch.
      </Lead>

      <div className="grid md:grid-cols-3 gap-8 mt-12">
        <div className="bg-neutral-200 dark:bg-neutral-700 p-6 rounded-2xl">
          <h4 className="font-semibold text-neutral-700 dark:text-neutral-200 mb-2">
            Undervalued
          </h4>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Trading below what the fundamentals support
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-2xl text-white">
          <h4 className="font-semibold mb-2">Fairly Valued</h4>
          <p className="text-sm text-white/80">
            Price and business roughly in line
          </p>
        </div>
        <div className="bg-neutral-200 dark:bg-neutral-700 p-6 rounded-2xl">
          <h4 className="font-semibold text-neutral-700 dark:text-neutral-200 mb-2">
            Overvalued
          </h4>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Priced for perfection, with little room for error
          </p>
        </div>
      </div>

      <div className="space-y-6 mt-12">
        <DetailRow
          icon={Landmark}
          tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
          title="Financial Health"
        >
          Profitability, margins, and balance-sheet strength summarized without
          the accounting vocabulary
        </DetailRow>
        <DetailRow
          icon={TrendingUp}
          tone="bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
          title="Growth Prospects"
        >
          Where revenue is expanding, what is driving it, and how durable it
          looks
        </DetailRow>
        <DetailRow
          icon={Shield}
          tone="bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
          title="Competitive Position"
        >
          The moat, the rivals, and the comparable companies worth measuring it
          against
        </DetailRow>
      </div>

      <div className="mt-12 bg-neutral-200 dark:bg-neutral-700 p-6 rounded-2xl">
        <h3 className="text-xl font-semibold text-neutral-700 dark:text-neutral-200 mb-4">
          Key metrics, explained in context
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-neutral-600 dark:text-neutral-400">
          <div>• P/E ratio</div>
          <div>• Market capitalization</div>
          <div>• Revenue growth</div>
          <div>• Profit margin</div>
        </div>
      </div>

      <div className="mt-12">
        <CardCta
          href="/stock-analysis"
          gradient="from-indigo-500 to-purple-600"
          heading="Look past the ticker"
          blurb="Get a fundamental read on any company alongside its live price and chart."
          label="Analyze a company"
          icon={Landmark}
        />
      </div>
    </CardShell>
  );
};

const RiskContent = () => {
  return (
    <CardShell>
      <Lead headline="See the downside before you commit.">
        Anything can look good on a green day. Every Zeitgeist analysis names
        the specific risks in a position, rates the overall exposure, and says
        how confident it is in its own conclusion.
      </Lead>

      <div className="grid md:grid-cols-3 gap-8 mt-12">
        <div className="text-center">
          <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
            Low
          </div>
          <p className="text-neutral-600 dark:text-neutral-400">
            Stable business, contained volatility
          </p>
        </div>
        <div className="text-center">
          <div className="text-4xl font-bold text-amber-500 dark:text-amber-400 mb-2">
            Medium
          </div>
          <p className="text-neutral-600 dark:text-neutral-400">
            Real upside, real swings to sit through
          </p>
        </div>
        <div className="text-center">
          <div className="text-4xl font-bold text-red-500 dark:text-red-400 mb-2">
            High
          </div>
          <p className="text-neutral-600 dark:text-neutral-400">
            Sharp moves in both directions
          </p>
        </div>
      </div>

      <div className="space-y-6 mt-12">
        <DetailRow
          icon={Scale}
          tone="bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
          title="Catalysts vs. Concerns"
        >
          Both sides listed side by side, so the bull case never arrives without
          the bear case
        </DetailRow>
        <DetailRow
          icon={Shield}
          tone="bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
          title="Named Risk Factors"
        >
          Specific exposures — competition, margin pressure, concentration —
          rather than boilerplate warnings
        </DetailRow>
        <DetailRow
          icon={Brain}
          tone="bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
          title="Confidence Score"
        >
          A 0–100 rating on how strongly the data supports the call, so a thin
          read is never mistaken for a strong one
        </DetailRow>
      </div>

      <div className="mt-12">
        <CardCta
          href="/stock-analysis"
          gradient="from-rose-600 to-red-700"
          heading="Know what you are holding"
          blurb="Run any ticker and read the risk section before the recommendation."
          label="Assess a stock"
          icon={Shield}
        />
      </div>

      <Disclaimer>
        * Risk ratings are analytical opinions, not guarantees. Markets can move
        against any thesis.
      </Disclaimer>
    </CardShell>
  );
};

const PriceTargetsContent = () => {
  return (
    <CardShell>
      <Lead headline="Targets for every time horizon.">
        A recommendation without a number is just a vibe. Zeitgeist projects
        where a stock could trade across three horizons and pairs each call with
        the reasoning behind it.
      </Lead>

      <div className="grid md:grid-cols-3 gap-8 mt-12">
        <div className="bg-neutral-200 dark:bg-neutral-700 p-6 rounded-2xl">
          <h4 className="font-semibold text-neutral-700 dark:text-neutral-200 mb-2">
            Short Term
          </h4>
          <p className="text-3xl font-bold text-neutral-700 dark:text-neutral-200 mb-4">
            1–3 mo
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Driven by momentum and nearby technical levels
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-2xl text-white">
          <h4 className="font-semibold mb-2">Medium Term</h4>
          <p className="text-3xl font-bold mb-4">3–12 mo</p>
          <p className="text-sm text-white/80">
            Earnings trajectory and sector conditions take over
          </p>
        </div>
        <div className="bg-neutral-200 dark:bg-neutral-700 p-6 rounded-2xl">
          <h4 className="font-semibold text-neutral-700 dark:text-neutral-200 mb-2">
            Long Term
          </h4>
          <p className="text-3xl font-bold text-neutral-700 dark:text-neutral-200 mb-4">
            1 yr+
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Anchored to fundamentals and competitive position
          </p>
        </div>
      </div>

      <div className="mt-12 bg-neutral-200 dark:bg-neutral-700 p-6 rounded-2xl">
        <h3 className="text-xl font-semibold text-neutral-700 dark:text-neutral-200 mb-4">
          Every analysis ends with a clear call
        </h3>
        <div className="grid md:grid-cols-5 gap-3 text-center text-sm font-medium">
          <div className="rounded-xl bg-emerald-600 px-3 py-3 text-white">
            Strong Buy
          </div>
          <div className="rounded-xl bg-emerald-500/80 px-3 py-3 text-white">
            Buy
          </div>
          <div className="rounded-xl bg-neutral-500 px-3 py-3 text-white">
            Hold
          </div>
          <div className="rounded-xl bg-red-500/80 px-3 py-3 text-white">
            Sell
          </div>
          <div className="rounded-xl bg-red-600 px-3 py-3 text-white">
            Strong Sell
          </div>
        </div>
      </div>

      <div className="mt-12">
        <CardCta
          href="/stock-analysis"
          gradient="from-violet-600 to-fuchsia-700"
          heading="Get a target on any ticker"
          blurb="Short, medium, and long-term projections with the reasoning attached — free to run."
          label="Run an analysis"
          icon={Target}
        />
      </div>

      <Disclaimer>
        * Projections are model estimates, not promises. Not financial advice.
      </Disclaimer>
    </CardShell>
  );
};

const data = [
  {
    category: "Stock Analysis",
    title: "AI-powered investment insights.",
    src: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    content: <StockAnalysisContent />,
  },
  {
    category: "AI CFO",
    title: "A chief financial officer, on call.",
    src: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2070&auto=format&fit=crop",
    content: <CfoContent />,
  },
  {
    category: "Market Data",
    title: "Live prices, straight from the tape.",
    src: "https://images.unsplash.com/photo-1560221328-12fe60f83ab8?q=80&w=2070&auto=format&fit=crop",
    content: <MarketDataContent />,
  },
  {
    category: "Technical Analysis",
    title: "Read the chart, not the noise.",
    src: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?q=80&w=2070&auto=format&fit=crop",
    content: <TechnicalContent />,
  },
  {
    category: "Fundamentals",
    title: "What the business is worth.",
    src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop",
    content: <FundamentalsContent />,
  },
  {
    category: "Risk",
    title: "See the downside first.",
    src: "https://images.unsplash.com/photo-1642790106117-e829e14a795f?q=80&w=2070&auto=format&fit=crop",
    content: <RiskContent />,
  },
  {
    category: "Price Targets",
    title: "Targets for every time horizon.",
    src: "https://images.unsplash.com/photo-1633158829585-23ba8f7c8caf?q=80&w=2070&auto=format&fit=crop",
    content: <PriceTargetsContent />,
  },
];
