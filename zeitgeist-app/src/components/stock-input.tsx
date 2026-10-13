"use client";

import React, { useState, useCallback, useEffect, useRef, useId } from 'react';
import { Search, TrendingUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateStockTicker } from '@/lib/stock-utils';

import { POPULAR_STOCKS, resolveStockQuery, searchStocks, type StockSuggestion } from '@/lib/stock-search';

interface StockInputProps {
  onSearch: (ticker: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showSuggestions?: boolean;
  autoFocus?: boolean;
  selectedTicker?: string;
}

export function StockInput({
  onSearch,
  isLoading = false,
  placeholder = "Enter stock symbol (e.g., AAPL, MSFT)",
  disabled = false,
  className,
  showSuggestions = true,
  autoFocus = false,
  selectedTicker = ""
}: StockInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [matches, setMatches] = useState<{ query: string; stocks: StockSuggestion[]; limited: boolean } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const query = inputValue.trim().toLowerCase();
  const searching = Boolean(query && showSuggestions && showDropdown && matches?.query !== query);
  const filteredSuggestions = matches?.query === query ? matches.stocks : searchStocks(POPULAR_STOCKS, query, query ? 12 : 6);
  const validation = validateStockTicker(resolveStockQuery(inputValue, filteredSuggestions));
  const listId = useId();
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(selectedTicker);
    setError('');
  }, [selectedTicker]);

  useEffect(() => {
    if (!query || !showSuggestions || !showDropdown) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/stock-search?q=' + encodeURIComponent(query), {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        });
        if (!response.ok) throw new Error('Search unavailable');
        const data = await response.json();
        if (!Array.isArray(data.results) || !data.results.every((stock: StockSuggestion) =>
          stock && typeof stock.symbol === 'string' && /^[A-Z]{1,5}$/.test(stock.symbol) && typeof stock.name === 'string')) throw new Error('Invalid search results');
        if (!controller.signal.aborted) {
          setMatches({ query, stocks: data.results.slice(0, 12), limited: data.limited === true });
          setHighlightedIndex(-1);
        }
      } catch {
        if (!controller.signal.aborted) setMatches({ query, stocks: searchStocks(POPULAR_STOCKS, query), limited: true });
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, showSuggestions, showDropdown]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    setError('');
    setShowDropdown(showSuggestions);
    setHighlightedIndex(-1);
  }, [showSuggestions]);

  // Handle search submission
  const handleSearch = useCallback(() => {
    if (validation.isValid && !isLoading && !disabled) {
      onSearch(validation.formattedTicker);
      setShowDropdown(false);
      setError('');
    } else if (query && !isLoading && !disabled) {
      setError(searching ? 'Searching company names… Select a result when it appears.'
        : 'Choose a matching company or enter a US ticker with 1–5 letters. Other markets and symbols with punctuation are not supported yet.');
    }
  }, [validation, isLoading, disabled, onSearch, query, searching]);

  // Handle Enter key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || isLoading || disabled) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showDropdown && highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
        // Select highlighted suggestion
        const selectedStock = filteredSuggestions[highlightedIndex];
        onSearch(selectedStock.symbol);
        setInputValue(selectedStock.symbol);
        setError('');
        setShowDropdown(false);
        setHighlightedIndex(-1);
      } else {
        handleSearch();
      }
    } else if (e.key === 'ArrowDown' && showDropdown) {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp' && showDropdown) {
      e.preventDefault();
      setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setHighlightedIndex(-1);
    }
  }, [showDropdown, highlightedIndex, filteredSuggestions, handleSearch, onSearch, isLoading, disabled]);

  // Handle suggestion selection
  const handleSuggestionClick = useCallback((stock: StockSuggestion) => {
    if (isLoading || disabled) return;
    inputRef.current?.focus();
    setInputValue(stock.symbol);
    setError('');
    setShowDropdown(false);
    setHighlightedIndex(-1);
    onSearch(stock.symbol);
  }, [isLoading, disabled, onSearch]);

  // Handle input focus
  const handleFocus = useCallback(() => {
    if (showSuggestions) {
      setShowDropdown(true);
    }
  }, [showSuggestions]);

  // Close only when focus leaves the entire search widget; no stale blur timer.
  const handleBlur = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setShowDropdown(false);
      setHighlightedIndex(-1);
    }
  }, []);

  // Clear input
  const handleClear = useCallback(() => {
    setInputValue('');
    setError('');
    setShowDropdown(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  }, []);

  // Auto-focus effect
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className={cn("relative w-full max-w-md", className)} onBlur={handleBlur}>
      {/* Input Container */}
      <div className="relative">
        <div
          className={cn(
            "relative flex items-center gap-1 w-full terminal-search rounded-xl border border-input p-1.5 text-sm",
            "transition-colors focus-within:border-[#0071e3] focus-within:ring-2 focus-within:ring-[#0071e3]/40",
            error && "border-destructive focus-within:border-destructive focus-within:ring-destructive/40",
            validation.isValid && "border-[#0071e3]",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          {/* Search Icon */}
          <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />

          {/* Input Field */}
          <input
            ref={inputRef}
            type="text"
            aria-label="Stock symbol"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showSuggestions && showDropdown}
            aria-controls={listId}
            aria-activedescendant={showDropdown && highlightedIndex >= 0 ? `${listId}-${highlightedIndex}` : undefined}
            aria-invalid={Boolean(error)}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            className={cn(
              "min-w-0 w-full flex-1 px-2 py-2.5 bg-transparent text-foreground placeholder:text-muted-foreground placeholder:normal-case placeholder:tracking-normal",
              "focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              "text-sm font-medium tracking-wide uppercase"
            )}
            maxLength={80}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />

          {/* Clear Button */}
          {inputValue && !isLoading && (
            <button
              onClick={handleClear}
              aria-label="Clear stock symbol"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              disabled={disabled}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}

        {/* Search Button */}
        <button
          onClick={handleSearch}
          disabled={!query || isLoading || disabled || (searching && !validation.isValid)}
          className={cn(
            "h-10 shrink-0 px-3 sm:px-5 rounded-xl",
            "bg-[#0071e3] text-white hover:bg-[#0077ed]",
            "disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed",
            "transition-all duration-200 ease-in-out",
            "flex items-center justify-center gap-2",
            "font-medium text-sm"
          )}
        >
          {isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-xl border-2 border-current border-t-transparent" />
          ) : (
            <TrendingUp className="h-4 w-4" />
          )}
          {!isLoading && "Analyze"}
        </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* Auto-complete Dropdown */}
      {showSuggestions && showDropdown && (
        <div
          ref={dropdownRef}
          id={listId}
          role="listbox"
          aria-label="Stock suggestions"
          className={cn(
            "absolute top-full mt-2 w-full bg-popover border border-border rounded-2xl shadow-lg z-50",
            "max-h-60 overflow-y-auto"
          )}
        >
          <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground" role="status">
            {searching ? 'Searching US companies…' : matches?.query === query && matches.limited
              ? 'Company search is limited right now. You can still enter an exact ticker.'
              : query ? 'US stocks & ETFs · 1–5 letter symbols' : 'Popular stocks · Search more companies by name or ticker'}
          </div>
          {filteredSuggestions.length > 0 ? (
            <div className="py-1">
              {filteredSuggestions.map((stock, index) => (
                <button
                  key={stock.symbol}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  onClick={() => handleSuggestionClick(stock)}
                  className={cn(
                    "w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground",
                    "focus:bg-accent focus:text-accent-foreground transition-colors",
                    index === highlightedIndex && "bg-accent text-accent-foreground"
                  )}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{stock.symbol}</span>
                    <span className="min-w-0 text-xs text-muted-foreground truncate" title={stock.name}>
                      {stock.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {searching ? 'Looking up matching symbols…' : 'No matching US listing. You can still try an exact ticker. Other markets are not supported yet.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StockInput;
